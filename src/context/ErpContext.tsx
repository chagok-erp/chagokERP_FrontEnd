import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_GRS,
  INITIAL_MATERIALS,
  INITIAL_POS,
  INITIAL_PRS,
  INITIAL_STOCK_BALANCES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_STORAGE_LOCATIONS,
  INITIAL_SUPPLIERS,
  INITIAL_WAREHOUSES,
  MOCK_USERS,
  SCREEN_PERMISSIONS,
} from '../data/mockData';
import { errorCodeToHttpStatus } from '../services/erpApi';
import {
  ApiErrorCode,
  AuditLog,
  GoodsReceipt,
  Material,
  PurchaseOrder,
  PurchaseRequisition,
  RequisitionItem,
  Role,
  ScreenId,
  StockBalance,
  StockMovement,
  StorageLocation,
  Supplier,
  User,
  ViewStateMode,
  Warehouse,
} from '../types/erp';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export interface PrDraftInput {
  draftId?: string;
  expectedVersion?: number;
  title: string;
  neededByDate?: string;
  source: 'UI' | 'AGENT' | 'DOCUMENT_AI';
  items: Array<{
    materialId: string;
    requestedQty: number;
    note?: string;
  }>;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
  idempotentReplay?: boolean;
  errorCode?: ApiErrorCode;
  httpStatus?: 401 | 403 | 404 | 409 | 422;
}

export interface CreatePoInput {
  requestId: string;
  prId: string;
  supplierId: string;
  note?: string;
  lines: Array<{
    prItemId: string;
    orderedQty: number;
    unitPrice?: number;
  }>;
}

export interface PostGrInput {
  requestId: string;
  poId: string;
  warehouseId: string;
  note?: string;
  lines: Array<{
    poItemId: string;
    qty: number;
    storageLocationId: string;
  }>;
}

interface ErpContextValue {
  // Auth & Navigation
  currentUser: User | null;
  sessionExpiredReason: string | null;
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  preselectedGrPoId: string | null;
  setPreselectedGrPoId: (poId: string | null) => void;
  navigateToGrWithPo: (poId: string) => void;
  viewStateMode: ViewStateMode;
  setViewStateMode: (mode: ViewStateMode) => void;
  loginAs: (userId: string) => void;
  logout: (reason?: string) => void;
  hasAnyRole: (allowed: Role[], userOverride?: User | null) => boolean;
  hasScreenPermission: (screen: ScreenId, role?: Role) => boolean;

  // Notifications
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], title: string, detail?: string) => void;
  dismissToast: (id: string) => void;

  // Domain Data
  materials: Material[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  storageLocations: StorageLocation[];
  prs: PurchaseRequisition[];
  pos: PurchaseOrder[];
  grs: GoodsReceipt[];
  stockMovements: StockMovement[];
  stockBalances: StockBalance[];
  auditLogs: AuditLog[];

  // Computed Helpers
  getTotalStockForMaterial: (materialId: string) => number;
  getLowStockMaterials: () => Array<Material & { currentStock: number; shortage: number }>;
  getMaterialsBelowThreshold: (threshold: number) => Array<Material & { currentStock: number; shortage: number }>;
  getPrItemOrderStats: (prId: string, prItemId: string) => {
    requestedQty: number;
    orderedQty: number;
    remainingToOrder: number;
  };
  hasPrRemainingToOrder: (prId: string) => boolean;

  // Master Data Actions (A / B)
  createMaterial: (input: Omit<Material, 'id' | 'updatedAt'>) => ActionResult<Material>;
  updateMaterial: (
    materialId: string,
    input: Partial<Pick<Material, 'name' | 'spec' | 'category' | 'unitPrice' | 'safetyStock'>>
  ) => ActionResult<Material>;
  toggleMaterialActive: (materialId: string) => ActionResult;
  createSupplier: (input: Omit<Supplier, 'id'>) => ActionResult<Supplier>;
  updateSupplier: (
    supplierId: string,
    input: Partial<Pick<Supplier, 'name' | 'contactName' | 'phone' | 'email' | 'businessNo' | 'active'>>
  ) => ActionResult<Supplier>;
  createWarehouse: (input: Omit<Warehouse, 'id'>) => ActionResult<Warehouse>;
  updateWarehouse: (
    warehouseId: string,
    input: Partial<Pick<Warehouse, 'name' | 'plantName' | 'active'>>
  ) => ActionResult<Warehouse>;
  createStorageLocation: (input: Omit<StorageLocation, 'id'>) => ActionResult<StorageLocation>;
  updateStorageLocation: (
    locationId: string,
    input: Partial<Pick<StorageLocation, 'name' | 'zone' | 'active'>>
  ) => ActionResult<StorageLocation>;

  // Shared PR Service (A — used by UI, Agent, Document AI)
  savePrDraft: (input: PrDraftInput) => ActionResult<PurchaseRequisition>;
  submitPr: (prId: string) => ActionResult<PurchaseRequisition>;
  reworkRejectedPr: (prId: string) => ActionResult<PurchaseRequisition>;

  // Approval Service (A)
  approvePr: (prId: string, comment?: string) => ActionResult<PurchaseRequisition>;
  rejectPr: (prId: string, reason: string) => ActionResult<PurchaseRequisition>;

  // PO Service (A — D-01 Split PO)
  createPoFromPr: (input: CreatePoInput) => ActionResult<PurchaseOrder>;

  // GR & Inventory Transaction Service (B orchestrates + A PO validation)
  postGoodsReceipt: (input: PostGrInput) => ActionResult<GoodsReceipt>;
}

const ErpContext = createContext<ErpContextValue | null>(null);

function fail<T = undefined>(errorCode: ApiErrorCode, message: string): ActionResult<T> {
  return {
    ok: false,
    message,
    errorCode,
    httpStatus: errorCodeToHttpStatus(errorCode),
  };
}

function nowTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// D-03 / v0.3 A-policy: EA and SET require integer quantity; KG/M/L support Decimal up to 3 decimal places
function normalizeQuantity(qty: number, unit: string): { ok: true; value: number } | { ok: false; message: string } {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, message: '수량은 0보다 커야 합니다.' };
  }
  if (unit === 'EA' || unit === 'SET') {
    if (!Number.isInteger(qty)) {
      return { ok: false, message: `${unit} 단위 품목은 정수 수량만 입력할 수 있습니다.` };
    }
    return { ok: true, value: qty };
  }
  const scaled = qty * 1000;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    return { ok: false, message: `${unit} 단위 품목은 소수점 셋째 자리까지만 입력할 수 있습니다.` };
  }
  return { ok: true, value: Math.round(scaled) / 1000 };
}

function normalizeSafetyStock(qty: number, unit: string): { ok: true; value: number } | { ok: false; message: string } {
  if (!Number.isFinite(qty) || qty < 0) {
    return { ok: false, message: '안전재고 수량은 0 이상이어야 합니다.' };
  }
  if (unit === 'EA' || unit === 'SET') {
    if (!Number.isInteger(qty)) {
      return { ok: false, message: `${unit} 단위 안전재고는 정수로 입력해 주세요.` };
    }
    return { ok: true, value: qty };
  }
  return { ok: true, value: Math.round(qty * 1000) / 1000 };
}

function buildPoPayloadSignature(input: CreatePoInput): string {
  const sorted = [...input.lines]
    .filter((l) => l.orderedQty > 0)
    .sort((a, b) => a.prItemId.localeCompare(b.prItemId))
    .map((l) => `${l.prItemId}:${Math.round(l.orderedQty * 1000) / 1000}:${l.unitPrice ?? ''}`)
    .join(',');
  return `${input.prId}|${input.supplierId}|${sorted}`;
}

function buildGrPayloadSignature(input: {
  poId: string;
  warehouseId: string;
  lines: Array<{ poItemId: string; qty: number; storageLocationId: string }>;
}): string {
  const sorted = [...input.lines]
    .filter((l) => l.qty > 0)
    .sort((a, b) => a.poItemId.localeCompare(b.poItemId))
    .map((l) => `${l.poItemId}:${Math.round(l.qty * 1000) / 1000}:${l.storageLocationId}`)
    .join(',');
  return `${input.poId}|${input.warehouseId}|${sorted}`;
}

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start logged in as 정관리(ADMIN) so every screen works immediately on first load, while LoginScreen & Role Switcher let users test every role
  const [currentUser, setCurrentUser] = useState<User | null>(MOCK_USERS[4] ?? null);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [activeScreen, setActiveScreenState] = useState<ScreenId>('dashboard');
  const [preselectedGrPoId, setPreselectedGrPoId] = useState<string | null>(null);
  const [viewStateMode, setViewStateMode] = useState<ViewStateMode>('normal');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [materials, setMaterials] = useState<Material[]>(INITIAL_MATERIALS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(INITIAL_STORAGE_LOCATIONS);
  const [prs, setPrs] = useState<PurchaseRequisition[]>(INITIAL_PRS);
  const [pos, setPos] = useState<PurchaseOrder[]>(INITIAL_POS);
  const [grs, setGrs] = useState<GoodsReceipt[]>(INITIAL_GRS);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>(INITIAL_STOCK_BALANCES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  const pushToast = useCallback((type: ToastMessage['type'], title: string, detail?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setActiveScreen = useCallback((screen: ScreenId) => {
    setActiveScreenState(screen);
    setViewStateMode('normal');
  }, []);

  const navigateToGrWithPo = useCallback((poId: string) => {
    setPreselectedGrPoId(poId);
    setActiveScreenState('gr');
    setViewStateMode('normal');
  }, []);

  const loginAs = useCallback(
    (userId: string) => {
      const found = MOCK_USERS.find((u) => u.id === userId);
      if (found) {
        setCurrentUser(found);
        setSessionExpiredReason(null);
        setViewStateMode('normal');
        pushToast('info', `${found.name} (${found.roleLabel}) 계정으로 전환됨`, `부서: ${found.department}`);
      }
    },
    [pushToast]
  );

  const logout = useCallback((reason?: string) => {
    setCurrentUser(null);
    setSessionExpiredReason(reason ?? null);
    setViewStateMode('normal');
  }, []);

  const hasAnyRole = useCallback(
    (allowed: Role[], userOverride?: User | null) => {
      const targetUser = userOverride !== undefined ? userOverride : currentUser;
      if (!targetUser) return false;
      const userRoles = targetUser.roles?.length ? targetUser.roles : [targetUser.role];
      return userRoles.some((r) => allowed.includes(r));
    },
    [currentUser]
  );

  const hasScreenPermission = useCallback(
    (screen: ScreenId, roleOverride?: Role) => {
      if (roleOverride) {
        return SCREEN_PERMISSIONS[screen].roles.includes(roleOverride);
      }
      if (!currentUser) return false;
      const userRoles = currentUser.roles?.length ? currentUser.roles : [currentUser.role];
      return userRoles.some((r) => SCREEN_PERMISSIONS[screen].roles.includes(r));
    },
    [currentUser]
  );

  const appendAudit = useCallback(
    (domain: AuditLog['domain'], docNumber: string, action: string, detail: string) => {
      if (!currentUser) return;
      const entry: AuditLog = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        domain,
        docNumber,
        action,
        actorName: currentUser.name,
        actorRole: currentUser.roleLabel,
        detail,
        timestamp: nowTimestamp(),
      };
      setAuditLogs((prev) => [entry, ...prev]);
    },
    [currentUser]
  );

  const getTotalStockForMaterial = useCallback(
    (materialId: string) => {
      return stockBalances
        .filter((b) => b.materialId === materialId)
        .reduce((sum, b) => sum + b.qtyOnHand, 0);
    },
    [stockBalances]
  );

  const getLowStockMaterials = useCallback(() => {
    return materials
      .filter((m) => m.active && m.safetyStock > 0)
      .map((m) => {
        const currentStock = getTotalStockForMaterial(m.id);
        return {
          ...m,
          currentStock,
          shortage: Math.max(0, m.safetyStock - currentStock),
        };
      })
      .filter((m) => m.currentStock < m.safetyStock);
  }, [materials, getTotalStockForMaterial]);

  // D-06 / BR-027: User-specified stock threshold query
  const getMaterialsBelowThreshold = useCallback(
    (threshold: number) => {
      if (!Number.isFinite(threshold) || threshold <= 0) return [];
      return materials
        .filter((m) => m.active)
        .map((m) => {
          const currentStock = getTotalStockForMaterial(m.id);
          return {
            ...m,
            currentStock,
            shortage: Math.max(0, Math.round((threshold - currentStock) * 1000) / 1000),
          };
        })
        .filter((m) => m.currentStock <= threshold);
    },
    [materials, getTotalStockForMaterial]
  );

  // D-01: PR item remaining-to-order helper (PR requestedQty - sum of valid PO item orderedQty)
  const getPrItemOrderStats = useCallback(
    (prId: string, prItemId: string) => {
      const pr = prs.find((p) => p.id === prId);
      const prItem = pr?.items.find((i) => i.id === prItemId);
      const requestedQty = prItem?.requestedQty ?? 0;
      const orderedQty = pos
        .filter((po) => po.sourcePrId === prId)
        .flatMap((po) => po.items)
        .filter((item) => item.sourcePrItemId === prItemId)
        .reduce((sum, item) => sum + item.orderedQty, 0);
      const cleanOrdered = Math.round(orderedQty * 1000) / 1000;
      const remainingToOrder = Math.max(0, Math.round((requestedQty - cleanOrdered) * 1000) / 1000);
      return {
        requestedQty,
        orderedQty: cleanOrdered,
        remainingToOrder,
      };
    },
    [prs, pos]
  );

  // D-01: Check whether any PR item still has remaining-to-order > 0 (never sum quantities across different units)
  const hasPrRemainingToOrder = useCallback(
    (prId: string) => {
      const pr = prs.find((p) => p.id === prId);
      if (!pr) return false;
      return pr.items.some((item) => getPrItemOrderStats(prId, item.id).remainingToOrder > 0);
    },
    [prs, getPrItemOrderStats]
  );

  // MAT-01
  const createMaterial = useCallback(
    (input: Omit<Material, 'id' | 'updatedAt'>): ActionResult<Material> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '품목 등록 권한(구매 담당자 또는 관리자)이 없습니다.');
      }
      const code = input.code.trim().toUpperCase();
      if (!code || !input.name.trim() || !input.spec.trim() || !input.category.trim()) {
        return fail('VALIDATION', '품목 코드, 분류, 품목명, 규격은 필수 입력값입니다.');
      }
      if (materials.some((m) => m.code.toUpperCase() === code)) {
        return fail('CONFLICT', `품목 코드(${code})가 이미 존재합니다. 중복 등록할 수 없습니다.`);
      }
      if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
        return fail('VALIDATION', '기준단가는 0원 이상이어야 합니다.');
      }
      const safetyCheck = normalizeSafetyStock(input.safetyStock, input.unit);
      if (!safetyCheck.ok) {
        return fail('VALIDATION', safetyCheck.message);
      }
      const created: Material = {
        ...input,
        code,
        name: input.name.trim(),
        spec: input.spec.trim(),
        category: input.category.trim(),
        unitPrice: Math.round(input.unitPrice),
        safetyStock: safetyCheck.value,
        id: `mat-${Date.now()}`,
        updatedAt: nowTimestamp(),
      };
      setMaterials((prev) => [created, ...prev]);
      appendAudit('MASTER', code, '품목 신규 등록', `${created.name} (${created.spec})`);
      return { ok: true, message: `품목 ${code}이(가) 등록되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, materials, appendAudit]
  );

  const updateMaterial = useCallback(
    (
      materialId: string,
      input: Partial<Pick<Material, 'name' | 'spec' | 'category' | 'unitPrice' | 'safetyStock'>>
    ): ActionResult<Material> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '품목 수정 권한(구매 담당자 또는 관리자)이 없습니다.');
      }
      const target = materials.find((m) => m.id === materialId);
      if (!target) return fail('NOT_FOUND', '존재하지 않는 품목입니다.');

      const nextName = input.name !== undefined ? input.name.trim() : target.name;
      const nextSpec = input.spec !== undefined ? input.spec.trim() : target.spec;
      const nextCat = input.category !== undefined ? input.category.trim() : target.category;
      const nextPrice = input.unitPrice !== undefined ? input.unitPrice : target.unitPrice;
      const nextSafety = input.safetyStock !== undefined ? input.safetyStock : target.safetyStock;

      if (!nextName || !nextSpec || !nextCat) {
        return fail('VALIDATION', '품목명, 규격, 분류는 비워둘 수 없습니다.');
      }
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return fail('VALIDATION', '기준단가는 0원 이상이어야 합니다.');
      }
      const safetyCheck = normalizeSafetyStock(nextSafety, target.unit);
      if (!safetyCheck.ok) {
        return fail('VALIDATION', safetyCheck.message);
      }

      const updated: Material = {
        ...target,
        name: nextName,
        spec: nextSpec,
        category: nextCat,
        unitPrice: Math.round(nextPrice),
        safetyStock: safetyCheck.value,
        updatedAt: nowTimestamp(),
      };
      setMaterials((prev) => prev.map((m) => (m.id === materialId ? updated : m)));
      appendAudit('MASTER', updated.code, '품목 정보 수정', `${updated.name} (${updated.spec}) · ${updated.unitPrice.toLocaleString()}원`);
      return { ok: true, message: `품목 ${updated.code} 정보가 수정되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, materials, appendAudit]
  );

  const toggleMaterialActive = useCallback(
    (materialId: string): ActionResult => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '품목 상태 변경 권한이 없습니다.');
      }
      const target = materials.find((m) => m.id === materialId);
      if (!target) return fail('NOT_FOUND', '존재하지 않는 품목입니다.');
      const nextActive = !target.active;
      setMaterials((prev) =>
        prev.map((m) => (m.id === materialId ? { ...m, active: nextActive, updatedAt: nowTimestamp() } : m))
      );
      appendAudit('MASTER', target.code, nextActive ? '품목 활성화' : '품목 비활성화', target.name);
      return { ok: true, message: `${target.code} 상태가 ${nextActive ? '활성' : '비활성'}으로 변경되었습니다.` };
    },
    [currentUser, hasAnyRole, materials, appendAudit]
  );

  // SUP-01
  const createSupplier = useCallback(
    (input: Omit<Supplier, 'id'>): ActionResult<Supplier> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '공급업체 등록 권한이 없습니다.');
      }
      const code = input.code.trim().toUpperCase();
      const email = input.email.trim();
      if (!code || !input.name.trim() || !input.phone.trim()) {
        return fail('VALIDATION', '업체 코드, 업체명, 전화번호는 필수입니다.');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail('VALIDATION', '올바른 이메일 형식을 입력해 주세요.');
      }
      if (suppliers.some((s) => s.code.toUpperCase() === code)) {
        return fail('CONFLICT', `공급업체 코드(${code})가 이미 존재합니다.`);
      }
      const created: Supplier = {
        ...input,
        code,
        name: input.name.trim(),
        contactName: input.contactName.trim(),
        phone: input.phone.trim(),
        email,
        businessNo: input.businessNo.trim(),
        id: `sup-${Date.now()}`,
      };
      setSuppliers((prev) => [created, ...prev]);
      appendAudit('MASTER', code, '공급업체 등록', `${created.name} (${created.phone})`);
      return { ok: true, message: `공급업체 ${created.name}이(가) 등록되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, suppliers, appendAudit]
  );

  const updateSupplier = useCallback(
    (
      supplierId: string,
      input: Partial<Pick<Supplier, 'name' | 'contactName' | 'phone' | 'email' | 'businessNo' | 'active'>>
    ): ActionResult<Supplier> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '공급업체 수정 권한이 없습니다.');
      }
      const target = suppliers.find((s) => s.id === supplierId);
      if (!target) return fail('NOT_FOUND', '존재하지 않는 공급업체입니다.');

      const nextName = input.name !== undefined ? input.name.trim() : target.name;
      const nextPhone = input.phone !== undefined ? input.phone.trim() : target.phone;
      const nextEmail = input.email !== undefined ? input.email.trim() : target.email;

      if (!nextName || !nextPhone) {
        return fail('VALIDATION', '공급업체명과 전화번호는 필수입니다.');
      }
      if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return fail('VALIDATION', '올바른 이메일 형식을 입력해 주세요.');
      }

      const updated: Supplier = {
        ...target,
        name: nextName,
        contactName: input.contactName !== undefined ? input.contactName.trim() : target.contactName,
        phone: nextPhone,
        email: nextEmail,
        businessNo: input.businessNo !== undefined ? input.businessNo.trim() : target.businessNo,
        active: input.active !== undefined ? input.active : target.active,
      };
      setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? updated : s)));
      appendAudit(
        'MASTER',
        updated.code,
        '공급업체 정보 수정',
        `${updated.name} (${updated.phone}) · ${updated.active ? '사용중' : '비활성'}`
      );
      return { ok: true, message: `공급업체 ${updated.name} 정보가 수정되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, suppliers, appendAudit]
  );

  // WH-01 Warehouse Create & Update + StorageLocation Create & Update
  const createWarehouse = useCallback(
    (input: Omit<Warehouse, 'id'>): ActionResult<Warehouse> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['WAREHOUSE', 'ADMIN'])) {
        return fail('FORBIDDEN', '창고 등록 권한(창고 담당자 또는 관리자)이 없습니다.');
      }
      const code = input.code.trim().toUpperCase();
      if (!code || !input.name.trim() || !input.plantName.trim()) {
        return fail('VALIDATION', '창고 코드, 창고명, 소속 공장명은 필수입니다.');
      }
      if (warehouses.some((w) => w.code.toUpperCase() === code)) {
        return fail('CONFLICT', `창고 코드(${code})가 이미 존재합니다.`);
      }
      const created: Warehouse = {
        ...input,
        code,
        name: input.name.trim(),
        plantName: input.plantName.trim(),
        id: `wh-${Date.now()}`,
      };
      setWarehouses((prev) => [...prev, created]);
      appendAudit('MASTER', code, '창고 신규 등록', `${created.name} (${created.plantName})`);
      return { ok: true, message: `창고 ${code}이(가) 등록되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, warehouses, appendAudit]
  );

  const updateWarehouse = useCallback(
    (
      warehouseId: string,
      input: Partial<Pick<Warehouse, 'name' | 'plantName' | 'active'>>
    ): ActionResult<Warehouse> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['WAREHOUSE', 'ADMIN'])) {
        return fail('FORBIDDEN', '창고 수정 권한(창고 담당자 또는 관리자)이 없습니다.');
      }
      const target = warehouses.find((w) => w.id === warehouseId);
      if (!target) return fail('NOT_FOUND', '존재하지 않는 창고입니다.');
      const nextName = input.name !== undefined ? input.name.trim() : target.name;
      const nextPlant = input.plantName !== undefined ? input.plantName.trim() : target.plantName;
      if (!nextName || !nextPlant) {
        return fail('VALIDATION', '창고명과 소속 공장명은 비워둘 수 없습니다.');
      }
      const updated: Warehouse = {
        ...target,
        name: nextName,
        plantName: nextPlant,
        active: input.active !== undefined ? input.active : target.active,
      };
      setWarehouses((prev) => prev.map((w) => (w.id === warehouseId ? updated : w)));
      appendAudit(
        'MASTER',
        updated.code,
        '창고 정보 수정',
        `${updated.name} (${updated.plantName}) · ${updated.active ? '사용중' : '비활성'}`
      );
      return { ok: true, message: `창고 ${updated.code} 정보가 수정되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, warehouses, appendAudit]
  );

  const createStorageLocation = useCallback(
    (input: Omit<StorageLocation, 'id'>): ActionResult<StorageLocation> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['WAREHOUSE', 'ADMIN'])) {
        return fail('FORBIDDEN', '저장위치 등록 권한(창고 담당자 또는 관리자)이 없습니다.');
      }
      const wh = warehouses.find((w) => w.id === input.warehouseId);
      if (!wh) {
        return fail('VALIDATION', '유효한 소속 창고를 선택해 주세요.');
      }
      const code = input.code.trim().toUpperCase();
      if (!code || !input.name.trim() || !input.zone.trim()) {
        return fail('VALIDATION', '저장위치 코드, 위치명, 보관 구역은 필수입니다.');
      }
      if (storageLocations.some((l) => l.code.toUpperCase() === code)) {
        return fail('CONFLICT', `저장위치 코드(${code})가 이미 존재합니다.`);
      }
      const created: StorageLocation = {
        ...input,
        code,
        name: input.name.trim(),
        zone: input.zone.trim(),
        id: `loc-${Date.now()}`,
      };
      setStorageLocations((prev) => [...prev, created]);
      appendAudit('MASTER', code, '저장위치 등록', `${created.name} (${created.zone})`);
      return { ok: true, message: `저장위치 ${code}이(가) 추가되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, warehouses, storageLocations, appendAudit]
  );

  const updateStorageLocation = useCallback(
    (
      locationId: string,
      input: Partial<Pick<StorageLocation, 'name' | 'zone' | 'active'>>
    ): ActionResult<StorageLocation> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['WAREHOUSE', 'ADMIN'])) {
        return fail('FORBIDDEN', '저장위치 수정 권한(창고 담당자 또는 관리자)이 없습니다.');
      }
      const target = storageLocations.find((l) => l.id === locationId);
      if (!target) return fail('NOT_FOUND', '존재하지 않는 저장위치입니다.');
      const nextName = input.name !== undefined ? input.name.trim() : target.name;
      const nextZone = input.zone !== undefined ? input.zone.trim() : target.zone;
      if (!nextName || !nextZone) {
        return fail('VALIDATION', '저장위치명과 보관 구역은 비워둘 수 없습니다.');
      }
      const updated: StorageLocation = {
        ...target,
        name: nextName,
        zone: nextZone,
        active: input.active !== undefined ? input.active : target.active,
      };
      setStorageLocations((prev) => prev.map((l) => (l.id === locationId ? updated : l)));
      appendAudit(
        'MASTER',
        updated.code,
        '저장위치 정보 수정',
        `${updated.name} (${updated.zone}) · ${updated.active ? '사용중' : '비활성'}`
      );
      return { ok: true, message: `저장위치 ${updated.code} 정보가 수정되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, storageLocations, appendAudit]
  );

  // PR-01 Shared PR Draft Service (UI + Agent + Document AI)
  const savePrDraft = useCallback(
    (input: PrDraftInput): ActionResult<PurchaseRequisition> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['REQUESTER', 'PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '구매요청 초안 생성/수정 권한이 없습니다.');
      }
      if (!input.title.trim()) {
        return fail('VALIDATION', '구매요청 제목을 입력해 주세요.');
      }
      if (!input.items.length) {
        return fail('VALIDATION', '최소 1개 이상의 품목을 포함해야 합니다.');
      }

      const seenMaterialIds = new Set<string>();
      const resolvedItems: RequisitionItem[] = [];
      for (let i = 0; i < input.items.length; i++) {
        const line = input.items[i];
        const mat = materials.find((m) => m.id === line.materialId);
        if (!mat) {
          return fail('VALIDATION', `${i + 1}번째 품목이 ERP 품목 마스터에 존재하지 않습니다.`);
        }
        if (!mat.active) {
          return fail('VALIDATION', `비활성(단종) 품목 [${mat.code} ${mat.name}]은 요청할 수 없습니다.`);
        }
        if (seenMaterialIds.has(mat.id)) {
          return fail('VALIDATION', `동일 구매요청 내에 같은 품목([${mat.code}] ${mat.name})을 중복 추가할 수 없습니다.`);
        }
        seenMaterialIds.add(mat.id);

        const qtyCheck = normalizeQuantity(line.requestedQty, mat.unit);
        if (!qtyCheck.ok) {
          return fail('VALIDATION', `[${mat.name}] ${qtyCheck.message}`);
        }
        resolvedItems.push({
          id: `pri-${Date.now()}-${i + 1}`,
          materialId: mat.id,
          materialCode: mat.code,
          materialName: mat.name,
          spec: mat.spec,
          unit: mat.unit,
          requestedQty: qtyCheck.value,
          estimatedUnitPrice: mat.unitPrice,
          note: line.note,
        });
      }

      const ts = nowTimestamp();

      if (input.draftId) {
        const existing = prs.find((p) => p.id === input.draftId);
        if (!existing) {
          return fail('NOT_FOUND', '수정할 PR 초안을 찾을 수 없습니다.');
        }
        // RBAC-MATRIX v0.2: Even ADMIN cannot proxy-edit another user's DRAFT
        if (existing.requesterId !== currentUser.id) {
          return fail('FORBIDDEN', '본인이 작성한 PR 초안만 수정할 수 있습니다 (대리 수정 불가).');
        }
        if (existing.status !== 'DRAFT') {
          return fail('CONFLICT', `현재 상태(${existing.status})에서는 수정할 수 없습니다. DRAFT 상태만 수정 가능합니다.`);
        }
        if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
          return fail(
            'CONFLICT',
            `버전 충돌이 발생했습니다 (요청 v${input.expectedVersion} ≠ 현재 v${existing.version}). 최신 상태를 다시 확인해 주세요.`
          );
        }

        const updated: PurchaseRequisition = {
          ...existing,
          title: input.title.trim(),
          neededByDate:
            input.neededByDate !== undefined
              ? input.neededByDate.trim() || undefined
              : existing.neededByDate,
          version: existing.version + 1,
          items: resolvedItems,
          updatedAt: ts,
          history: [
            ...existing.history,
            {
              id: `h-${Date.now()}`,
              action: 'UPDATED',
              actorId: currentUser.id,
              actorName: currentUser.name,
              timestamp: ts,
              comment: input.source === 'AGENT' ? 'AI Assistant 후속 대화 수정 반영' : '초안 내용 수정',
            },
          ],
        };

        setPrs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        appendAudit(
          input.source === 'UI' ? 'PR' : 'AI',
          updated.prNumber,
          `PR 초안 수정 (v${updated.version})`,
          `${updated.items.length}개 품목 · 경로: ${input.source}`
        );
        return { ok: true, message: `${updated.prNumber} (v${updated.version}) 초안이 수정되었습니다.`, data: updated };
      }

      const seq = 101 + prs.length;
      const prNumber = `PR-2026-0${seq}`;
      const created: PurchaseRequisition = {
        id: `pr-${Date.now()}`,
        prNumber,
        title: input.title.trim(),
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        department: currentUser.department,
        source: input.source,
        status: 'DRAFT',
        version: 1,
        neededByDate: input.neededByDate?.trim() || undefined,
        items: resolvedItems,
        history: [
          {
            id: `h-${Date.now()}`,
            action: 'CREATED',
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: ts,
            comment:
              input.source === 'AGENT'
                ? '대화형 AI Agent 초안 생성'
                : input.source === 'DOCUMENT_AI'
                  ? '문서 분석 품목 검토 후 초안 생성'
                  : '화면 직접 작성',
          },
        ],
        createdAt: ts,
        updatedAt: ts,
      };

      setPrs((prev) => [created, ...prev]);
      appendAudit(
        input.source === 'UI' ? 'PR' : 'AI',
        created.prNumber,
        'PR 초안 생성',
        `${created.title} (${created.items.length}개 품목 · 경로: ${input.source})`
      );
      return { ok: true, message: `${created.prNumber} 초안이 생성되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, materials, prs, appendAudit]
  );

  // PR-02 Submit
  const submitPr = useCallback(
    (prId: string): ActionResult<PurchaseRequisition> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      const target = prs.find((p) => p.id === prId);
      if (!target) return fail('NOT_FOUND', '구매요청을 찾을 수 없습니다.');
      // RBAC-MATRIX v0.2: Even ADMIN cannot proxy-submit another user's PR
      if (target.requesterId !== currentUser.id) {
        return fail('FORBIDDEN', '요청자 본인만 구매요청을 제출할 수 있습니다.');
      }
      if (target.status !== 'DRAFT') {
        return fail('CONFLICT', 'DRAFT 상태의 요청만 제출할 수 있습니다.');
      }
      if (!target.neededByDate?.trim()) {
        return fail('VALIDATION', '구매요청을 제출하려면 납품 필요일을 입력해야 합니다.');
      }
      if (!target.items.length) {
        return fail('VALIDATION', '품목이 없는 요청은 제출할 수 없습니다.');
      }

      const ts = nowTimestamp();
      const updated: PurchaseRequisition = {
        ...target,
        status: 'SUBMITTED',
        updatedAt: ts,
        history: [
          ...target.history,
          { id: `h-${Date.now()}`, action: 'SUBMITTED', actorId: currentUser.id, actorName: currentUser.name, timestamp: ts },
        ],
      };
      setPrs((prev) => prev.map((p) => (p.id === prId ? updated : p)));
      appendAudit('PR', updated.prNumber, '구매요청 제출', `${updated.title}`);
      return { ok: true, message: `${updated.prNumber}이(가) 승인 대기 상태로 제출되었습니다.`, data: updated };
    },
    [currentUser, prs, appendAudit]
  );

  // PR-02 Rework REJECTED -> DRAFT
  const reworkRejectedPr = useCallback(
    (prId: string): ActionResult<PurchaseRequisition> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      const target = prs.find((p) => p.id === prId);
      if (!target) return fail('NOT_FOUND', '구매요청을 찾을 수 없습니다.');
      if (target.requesterId !== currentUser.id) {
        return fail('FORBIDDEN', '요청자 본인만 재작업을 시작할 수 있습니다.');
      }
      if (target.status !== 'REJECTED') {
        return fail('CONFLICT', '반려(REJECTED) 상태의 문서만 재작업을 시작할 수 있습니다.');
      }
      const ts = nowTimestamp();
      const updated: PurchaseRequisition = {
        ...target,
        status: 'DRAFT',
        version: target.version + 1,
        updatedAt: ts,
        history: [
          ...target.history,
          {
            id: `h-${Date.now()}`,
            action: 'REWORKED',
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: ts,
            comment: '반려 사유 확인 후 초안으로 재작업 전환',
          },
        ],
      };
      setPrs((prev) => prev.map((p) => (p.id === prId ? updated : p)));
      appendAudit('PR', updated.prNumber, '반려 PR 재작업 전환', `v${updated.version} DRAFT 전환`);
      return { ok: true, message: `${updated.prNumber}이(가) 수정 가능한 초안(DRAFT)으로 전환되었습니다.`, data: updated };
    },
    [currentUser, prs, appendAudit]
  );

  // APR-01 Header Batch Approve (D-02)
  const approvePr = useCallback(
    (prId: string, comment?: string): ActionResult<PurchaseRequisition> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['APPROVER', 'ADMIN'])) {
        return fail('FORBIDDEN', '승인 권한(승인자 또는 관리자)이 없습니다.');
      }
      const target = prs.find((p) => p.id === prId);
      if (!target) return fail('NOT_FOUND', '구매요청을 찾을 수 없습니다.');
      if (target.requesterId === currentUser.id) {
        return fail('FORBIDDEN', '요청자 본인(관리자 포함)은 자신의 구매요청을 승인할 수 없습니다.');
      }
      if (target.status !== 'SUBMITTED') {
        return fail('CONFLICT', `이미 처리되었거나 제출되지 않은 문서입니다 (현재 상태: ${target.status}).`);
      }

      const ts = nowTimestamp();
      const updated: PurchaseRequisition = {
        ...target,
        status: 'APPROVED',
        updatedAt: ts,
        history: [
          ...target.history,
          {
            id: `h-${Date.now()}`,
            action: 'APPROVED',
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: ts,
            comment: comment?.trim() || '요청 전체 일괄 승인 완료',
          },
        ],
      };
      setPrs((prev) => prev.map((p) => (p.id === prId ? updated : p)));
      appendAudit('PR', updated.prNumber, '구매요청 일괄 승인', comment?.trim() || '헤더 전체 일괄 승인 완료');
      return { ok: true, message: `${updated.prNumber}이(가) 일괄 승인되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, prs, appendAudit]
  );

  // APR-01 Header Batch Reject (D-02)
  const rejectPr = useCallback(
    (prId: string, reason: string): ActionResult<PurchaseRequisition> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['APPROVER', 'ADMIN'])) {
        return fail('FORBIDDEN', '반려 권한(승인자 또는 관리자)이 없습니다.');
      }
      if (!reason.trim()) {
        return fail('VALIDATION', '반려 시 사유 입력은 필수입니다.');
      }
      const target = prs.find((p) => p.id === prId);
      if (!target) return fail('NOT_FOUND', '구매요청을 찾을 수 없습니다.');
      if (target.requesterId === currentUser.id) {
        return fail('FORBIDDEN', '요청자 본인(관리자 포함)은 자신의 구매요청을 반려할 수 없습니다.');
      }
      if (target.status !== 'SUBMITTED') {
        return fail('CONFLICT', '제출(SUBMITTED) 상태의 요청만 반려할 수 있습니다.');
      }

      const ts = nowTimestamp();
      const updated: PurchaseRequisition = {
        ...target,
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        updatedAt: ts,
        history: [
          ...target.history,
          {
            id: `h-${Date.now()}`,
            action: 'REJECTED',
            actorId: currentUser.id,
            actorName: currentUser.name,
            timestamp: ts,
            comment: reason.trim(),
          },
        ],
      };
      setPrs((prev) => prev.map((p) => (p.id === prId ? updated : p)));
      appendAudit('PR', updated.prNumber, '구매요청 일괄 반려', reason.trim());
      return { ok: true, message: `${updated.prNumber}이(가) 반려되었습니다.`, data: updated };
    },
    [currentUser, hasAnyRole, prs, appendAudit]
  );

  // PO-01 Internal Split PO Creation (D-01: 1 PR -> N PO, per-supplier, PR item remaining check & idempotency, BR-001, BR-005, BR-019, BR-024)
  const createPoFromPr = useCallback(
    (input: CreatePoInput): ActionResult<PurchaseOrder> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['PURCHASER', 'ADMIN'])) {
        return fail('FORBIDDEN', '발주 생성 권한(구매 담당자 또는 관리자)이 없습니다.');
      }

      const reqKey = input.requestId.trim();
      if (!reqKey) {
        return fail('VALIDATION', '발주 요청 식별 키(requestKey)가 필요합니다.');
      }

      const signature = buildPoPayloadSignature(input);
      const duplicatePo = pos.find((po) => po.requestId === reqKey);
      if (duplicatePo) {
        const existingSig =
          duplicatePo.payloadSignature ??
          buildPoPayloadSignature({
            requestId: duplicatePo.requestId,
            prId: duplicatePo.sourcePrId,
            supplierId: duplicatePo.supplierId,
            lines: duplicatePo.items.map((i) => ({
              prItemId: i.sourcePrItemId,
              orderedQty: i.orderedQty,
              unitPrice: i.unitPrice,
            })),
          });
        if (existingSig === signature) {
          return {
            ok: true,
            idempotentReplay: true,
            message: `동일 요청 키(${reqKey}) 재시도: 기존 발주서(${duplicatePo.poNumber})를 반환하며 중복 생성은 차단되었습니다.`,
            data: duplicatePo,
          };
        }
        return fail(
          'CONFLICT',
          `멱등 충돌(409): 요청 키(${reqKey})가 이미 다른 발주 내역(${duplicatePo.poNumber})에 사용되었습니다. 새 요청 키를 발급해 주세요.`
        );
      }

      const pr = prs.find((p) => p.id === input.prId);
      if (!pr) return fail('NOT_FOUND', '원본 구매요청(PR)을 찾을 수 없습니다.');
      if (pr.status !== 'APPROVED') {
        return fail('CONFLICT', '승인(APPROVED)되지 않은 PR로는 발주를 생성할 수 없습니다.');
      }

      const supplier = suppliers.find((s) => s.id === input.supplierId && s.active);
      if (!supplier) {
        return fail('VALIDATION', '유효한 활성 공급업체를 선택해 주세요.');
      }

      const nonZeroLines = input.lines.filter((l) => l.orderedQty > 0);
      if (!nonZeroLines.length) {
        return fail('VALIDATION', '최소 1개 이상의 품목에 대해 0보다 큰 발주 수량을 입력해 주세요.');
      }

      const seenPrItems = new Set<string>();
      const preparedItems: PurchaseOrder['items'] = [];
      const poId = `po-${Date.now()}`;

      for (let idx = 0; idx < nonZeroLines.length; idx++) {
        const line = nonZeroLines[idx];
        if (seenPrItems.has(line.prItemId)) {
          return fail('VALIDATION', '한 발주서에 동일한 구매요청 품목을 중복 지정할 수 없습니다.');
        }
        seenPrItems.add(line.prItemId);

        const prItem = pr.items.find((i) => i.id === line.prItemId);
        if (!prItem) {
          return fail('VALIDATION', '선택한 구매요청에 존재하지 않는 품목 항목입니다.');
        }

        const mat = materials.find((m) => m.id === prItem.materialId && m.active);
        if (!mat) {
          return fail('VALIDATION', `[${prItem.materialName}] 비활성 또는 존재하지 않는 품목입니다.`);
        }

        const qtyCheck = normalizeQuantity(line.orderedQty, prItem.unit);
        if (!qtyCheck.ok) {
          return fail('VALIDATION', `[${prItem.materialName}] ${qtyCheck.message}`);
        }

        const stats = getPrItemOrderStats(pr.id, prItem.id);
        if (qtyCheck.value > stats.remainingToOrder) {
          return fail(
            'CONFLICT',
            `[${prItem.materialName}] 미발주 잔량(${stats.remainingToOrder.toLocaleString()} ${prItem.unit})을 초과하여 ${qtyCheck.value.toLocaleString()} ${prItem.unit}을(를) 발주할 수 없습니다.`
          );
        }

        const unitPrice = line.unitPrice !== undefined ? line.unitPrice : prItem.estimatedUnitPrice;
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return fail('VALIDATION', `[${prItem.materialName}] 단가는 0원 이상이어야 합니다.`);
        }

        preparedItems.push({
          id: `poi-${Date.now()}-${idx + 1}`,
          poId,
          sourcePrItemId: prItem.id,
          materialId: prItem.materialId,
          materialCode: prItem.materialCode,
          materialName: prItem.materialName,
          spec: prItem.spec,
          unit: prItem.unit,
          orderedQty: qtyCheck.value,
          receivedQty: 0,
          unitPrice: Math.round(unitPrice),
        });
      }

      const seq = 201 + pos.length;
      const poNumber = `PO-2026-0${seq}`;
      const ts = nowTimestamp();

      const created: PurchaseOrder = {
        id: poId,
        poNumber,
        requestId: reqKey,
        payloadSignature: signature,
        sourcePrId: pr.id,
        sourcePrNumber: pr.prNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        supplierEmail: supplier.email,
        purchaserId: currentUser.id,
        purchaserName: currentUser.name,
        status: 'OPEN',
        createdAt: ts,
        note: input.note?.trim(),
        items: preparedItems,
      };

      setPos((prev) => [created, ...prev]);
      const totalAmt = created.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
      const itemSummary = created.items.map((i) => `${i.materialCode} ${i.orderedQty}${i.unit}`).join(', ');
      appendAudit(
        'PO',
        poNumber,
        '내부 분할 발주(PO) 생성',
        `${pr.prNumber} → ${supplier.name} (${itemSummary} · ${totalAmt.toLocaleString()}원)`
      );
      return { ok: true, message: `내부 발주서 ${poNumber}이(가) 생성되었습니다.`, data: created };
    },
    [currentUser, hasAnyRole, prs, pos, suppliers, materials, getPrItemOrderStats, appendAudit]
  );

  // GR-01 & GR-02 & ST-01 Atomic Transaction Simulation (v0.3 per-item storageLocationId, BR-006..BR-012, BR-020, BR-021)
  const postGoodsReceipt = useCallback(
    (input: PostGrInput): ActionResult<GoodsReceipt> => {
      if (!currentUser) return fail('UNAUTHORIZED', '로그인이 필요합니다.');
      if (!hasAnyRole(['WAREHOUSE', 'ADMIN'])) {
        return fail('FORBIDDEN', '입고 등록 권한(창고 담당자 또는 관리자)이 없습니다.');
      }

      const reqKey = input.requestId.trim();
      if (!reqKey) {
        return fail('VALIDATION', '요청 식별 키(requestKey)가 필요합니다.');
      }

      const grSignature = buildGrPayloadSignature(input);
      const duplicateGr = grs.find((g) => g.requestId === reqKey);
      if (duplicateGr) {
        const existingSig =
          duplicateGr.payloadSignature ??
          buildGrPayloadSignature({
            poId: duplicateGr.poId,
            warehouseId: duplicateGr.items[0]?.warehouseId ?? '',
            lines: duplicateGr.items.map((i) => ({
              poItemId: i.poItemId,
              qty: i.receivedQty,
              storageLocationId: i.storageLocationId,
            })),
          });
        if (existingSig === grSignature) {
          return {
            ok: true,
            idempotentReplay: true,
            message: `동일 요청 키(${reqKey}) 재시도: 기존 입고 결과(${duplicateGr.grNumber})를 반환하며 재고는 중복 반영되지 않았습니다.`,
            data: duplicateGr,
          };
        }
        return fail(
          'CONFLICT',
          `멱등 충돌(409): 요청 키(${reqKey})가 이미 다른 입고 내역(${duplicateGr.grNumber})에 사용되었습니다. 새 요청 키를 발급해 주세요.`
        );
      }

      const po = pos.find((p) => p.id === input.poId);
      if (!po) return fail('NOT_FOUND', '대상 구매발주(PO)를 찾을 수 없습니다.');
      if (po.status === 'RECEIVED') {
        return fail('CONFLICT', '이미 전량 입고 완료(RECEIVED)된 발주입니다.');
      }

      const wh = warehouses.find((w) => w.id === input.warehouseId && w.active);
      if (!wh) return fail('VALIDATION', '유효한 활성 창고를 선택해 주세요.');

      const nonZeroLines = input.lines.filter((l) => l.qty > 0);
      if (!nonZeroLines.length) {
        return fail('VALIDATION', '최소 1개 품목에 대해 0보다 큰 입고 수량을 입력해 주세요.');
      }

      // Validate ALL lines (including per-line storageLocationId) BEFORE mutating anything (BR-009)
      const seenPoItems = new Set<string>();
      const normalizedLineMap = new Map<string, { qty: number; location: StorageLocation }>();

      for (const line of nonZeroLines) {
        if (seenPoItems.has(line.poItemId)) {
          return fail('VALIDATION', '한 입고 요청에 동일한 발주 품목을 중복 지정할 수 없습니다.');
        }
        seenPoItems.add(line.poItemId);

        const poItem = po.items.find((i) => i.id === line.poItemId);
        if (!poItem) {
          return fail('VALIDATION', 'PO에 존재하지 않는 품목 항목입니다.');
        }

        const loc = storageLocations.find((l) => l.id === line.storageLocationId);
        if (!loc || loc.warehouseId !== wh.id || !loc.active) {
          return fail(
            'VALIDATION',
            `[${poItem.materialName}] 선택한 저장위치가 해당 창고(${wh.name}) 소속이 아니거나 비활성 상태입니다.`
          );
        }

        const mat = materials.find((m) => m.id === poItem.materialId);
        if (!mat || !mat.active || mat.unit !== poItem.unit) {
          return fail('VALIDATION', `[${poItem.materialName}] 품목 활성 상태 또는 기준단위가 일치하지 않습니다.`);
        }

        const qtyCheck = normalizeQuantity(line.qty, poItem.unit);
        if (!qtyCheck.ok) {
          return fail('VALIDATION', `[${poItem.materialName}] ${qtyCheck.message}`);
        }

        const remaining = Math.round((poItem.orderedQty - poItem.receivedQty) * 1000) / 1000;
        if (qtyCheck.value > remaining) {
          return fail(
            'CONFLICT',
            `[${poItem.materialName}] 미입고 잔량(${remaining.toLocaleString()} ${poItem.unit})을 초과하여 ${qtyCheck.value.toLocaleString()} ${poItem.unit}을(를) 입고할 수 없습니다.`
          );
        }
        normalizedLineMap.set(line.poItemId, { qty: qtyCheck.value, location: loc });
      }

      const ts = nowTimestamp();
      const grId = `gr-${Date.now()}`;
      const grSeq = 301 + grs.length;
      const grNumber = `GR-2026-0${grSeq}`;

      // 1. Update PO items & PO status (preserving orderedQty BR-006)
      const updatedPoItems = po.items.map((item) => {
        const entry = normalizedLineMap.get(item.id);
        if (!entry) return item;
        return {
          ...item,
          receivedQty: Math.round((item.receivedQty + entry.qty) * 1000) / 1000,
        };
      });
      const allCompleted = updatedPoItems.every((i) => i.orderedQty - i.receivedQty <= 0.0001);
      const nextPoStatus: PurchaseOrder['status'] = allCompleted ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      setPos((prev) =>
        prev.map((p) => (p.id === po.id ? { ...p, items: updatedPoItems, status: nextPoStatus } : p))
      );

      // 2. Create GR Document with per-line storageLocation
      const grItems = nonZeroLines.map((line, idx) => {
        const poItem = po.items.find((i) => i.id === line.poItemId)!;
        const entry = normalizedLineMap.get(line.poItemId)!;
        return {
          id: `gri-${Date.now()}-${idx + 1}`,
          grId,
          poItemId: poItem.id,
          materialId: poItem.materialId,
          materialCode: poItem.materialCode,
          materialName: poItem.materialName,
          unit: poItem.unit,
          receivedQty: entry.qty,
          warehouseId: wh.id,
          warehouseName: wh.name,
          storageLocationId: entry.location.id,
          storageLocationCode: entry.location.code,
        };
      });

      const createdGr: GoodsReceipt = {
        id: grId,
        grNumber,
        requestId: reqKey,
        payloadSignature: grSignature,
        poId: po.id,
        poNumber: po.poNumber,
        receiverId: currentUser.id,
        receiverName: currentUser.name,
        status: 'POSTED',
        items: grItems,
        postedAt: ts,
        note: input.note?.trim(),
      };
      setGrs((prev) => [createdGr, ...prev]);

      // 3. Create immutable StockMovements
      const newMovements: StockMovement[] = grItems.map((gi, idx) => ({
        id: `mov-${Date.now()}-${idx + 1}`,
        movementNo: `MOV-2026-${String(stockMovements.length + idx + 1).padStart(4, '0')}`,
        type: 'GR_IN',
        materialId: gi.materialId,
        materialCode: gi.materialCode,
        materialName: gi.materialName,
        unit: gi.unit,
        warehouseId: wh.id,
        warehouseName: wh.name,
        storageLocationId: gi.storageLocationId,
        storageLocationCode: gi.storageLocationCode,
        qtyDelta: gi.receivedQty,
        refDocNo: grNumber,
        actorName: currentUser.name,
        occurredAt: ts,
      }));
      setStockMovements((prev) => [...newMovements, ...prev]);

      // 4. Upsert StockBalances per (materialId, warehouseId, storageLocationId)
      setStockBalances((prev) => {
        const next = [...prev];
        for (const gi of grItems) {
          const existingIdx = next.findIndex(
            (b) =>
              b.materialId === gi.materialId &&
              b.warehouseId === gi.warehouseId &&
              b.storageLocationId === gi.storageLocationId
          );
          if (existingIdx >= 0) {
            next[existingIdx] = {
              ...next[existingIdx],
              qtyOnHand: Math.round((next[existingIdx].qtyOnHand + gi.receivedQty) * 1000) / 1000,
              updatedAt: ts,
            };
          } else {
            next.push({
              id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              materialId: gi.materialId,
              warehouseId: gi.warehouseId,
              storageLocationId: gi.storageLocationId,
              qtyOnHand: gi.receivedQty,
              updatedAt: ts,
            });
          }
        }
        return next;
      });

      const summaryText = grItems.map((i) => `${i.materialCode} +${i.receivedQty}${i.unit}(${i.storageLocationCode})`).join(', ');
      appendAudit('GR', grNumber, `입고 확정 (${nextPoStatus === 'RECEIVED' ? '완납' : '부분입고'})`, `${po.poNumber} · ${wh.name} · ${summaryText}`);

      return {
        ok: true,
        message: `${grNumber} 입고가 확정되었으며, PO 누적입고·재고 원장·현재고가 함께 반영되었습니다.`,
        data: createdGr,
      };
    },
    [currentUser, hasAnyRole, grs, pos, warehouses, storageLocations, materials, stockMovements.length, appendAudit]
  );

  const value = useMemo<ErpContextValue>(
    () => ({
      currentUser,
      sessionExpiredReason,
      activeScreen,
      setActiveScreen,
      preselectedGrPoId,
      setPreselectedGrPoId,
      navigateToGrWithPo,
      viewStateMode,
      setViewStateMode,
      loginAs,
      logout,
      hasAnyRole,
      hasScreenPermission,
      toasts,
      pushToast,
      dismissToast,
      materials,
      suppliers,
      warehouses,
      storageLocations,
      prs,
      pos,
      grs,
      stockMovements,
      stockBalances,
      auditLogs,
      getTotalStockForMaterial,
      getLowStockMaterials,
      getMaterialsBelowThreshold,
      getPrItemOrderStats,
      hasPrRemainingToOrder,
      createMaterial,
      updateMaterial,
      toggleMaterialActive,
      createSupplier,
      updateSupplier,
      createWarehouse,
      updateWarehouse,
      createStorageLocation,
      updateStorageLocation,
      savePrDraft,
      submitPr,
      reworkRejectedPr,
      approvePr,
      rejectPr,
      createPoFromPr,
      postGoodsReceipt,
    }),
    [
      currentUser,
      sessionExpiredReason,
      activeScreen,
      setActiveScreen,
      preselectedGrPoId,
      navigateToGrWithPo,
      viewStateMode,
      loginAs,
      logout,
      hasAnyRole,
      hasScreenPermission,
      toasts,
      pushToast,
      dismissToast,
      materials,
      suppliers,
      warehouses,
      storageLocations,
      prs,
      pos,
      grs,
      stockMovements,
      stockBalances,
      auditLogs,
      getTotalStockForMaterial,
      getLowStockMaterials,
      getMaterialsBelowThreshold,
      getPrItemOrderStats,
      hasPrRemainingToOrder,
      createMaterial,
      updateMaterial,
      toggleMaterialActive,
      createSupplier,
      updateSupplier,
      createWarehouse,
      updateWarehouse,
      createStorageLocation,
      updateStorageLocation,
      savePrDraft,
      submitPr,
      reworkRejectedPr,
      approvePr,
      rejectPr,
      createPoFromPr,
      postGoodsReceipt,
    ]
  );

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
};

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used within ErpProvider');
  return ctx;
}
