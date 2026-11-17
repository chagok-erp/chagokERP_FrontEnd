export type Role = 'REQUESTER' | 'APPROVER' | 'PURCHASER' | 'WAREHOUSE' | 'ADMIN';

export type ApiErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION';

export type ScreenId =
  | 'dashboard'
  | 'assistant'
  | 'materials'
  | 'suppliers'
  | 'warehouses'
  | 'pr'
  | 'approvals'
  | 'po'
  | 'gr'
  | 'inventory';

export type ViewStateMode = 'normal' | 'loading' | 'empty' | 'error' | 'forbidden';

export interface User {
  id: string;
  empNo: string;
  name: string;
  email: string;
  department: string;
  role: Role;
  roles: Role[];
  roleLabel: string;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: 'EA' | 'KG' | 'M' | 'SET' | 'L';
  unitPrice: number;
  safetyStock: number;
  category: string;
  active: boolean;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  businessNo: string;
  active: boolean;
}

export interface StorageLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  zone: string;
  active: boolean;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  plantName: string;
  active: boolean;
}

export type PrStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface RequisitionItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  spec: string;
  unit: string;
  requestedQty: number;
  estimatedUnitPrice: number;
  note?: string;
}

export interface PrHistoryEntry {
  id: string;
  action: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REWORKED';
  actorId: string;
  actorName: string;
  timestamp: string;
  comment?: string;
}

export interface PurchaseRequisition {
  id: string;
  prNumber: string;
  title: string;
  requesterId: string;
  requesterName: string;
  department: string;
  source: 'UI' | 'AGENT' | 'DOCUMENT_AI';
  status: PrStatus;
  version: number;
  neededByDate?: string;
  rejectionReason?: string;
  items: RequisitionItem[];
  history: PrHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type PoStatus = 'OPEN' | 'PARTIALLY_RECEIVED' | 'RECEIVED';

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  sourcePrItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  spec: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  requestId: string;
  payloadSignature?: string;
  sourcePrId: string;
  sourcePrNumber: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  purchaserId: string;
  purchaserName: string;
  status: PoStatus;
  items: PurchaseOrderItem[];
  createdAt: string;
  note?: string;
}

export interface GoodsReceiptItem {
  id: string;
  grId: string;
  poItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  receivedQty: number;
  warehouseId: string;
  warehouseName: string;
  storageLocationId: string;
  storageLocationCode: string;
}

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  requestId: string;
  payloadSignature?: string;
  poId: string;
  poNumber: string;
  receiverId: string;
  receiverName: string;
  status: 'POSTED';
  items: GoodsReceiptItem[];
  postedAt: string;
  note?: string;
}

export interface StockMovement {
  id: string;
  movementNo: string;
  type: 'GR_IN' | 'OPENING';
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  storageLocationId: string;
  storageLocationCode: string;
  qtyDelta: number;
  refDocNo: string;
  actorName: string;
  occurredAt: string;
}

export interface StockBalance {
  id: string;
  materialId: string;
  warehouseId: string;
  storageLocationId: string;
  qtyOnHand: number;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  domain: 'PR' | 'PO' | 'GR' | 'MASTER' | 'AI';
  docNumber: string;
  action: string;
  actorName: string;
  actorRole: string;
  detail: string;
  timestamp: string;
}

// Unified AI Assistant Types
export type MatchMethod = 'EXACT_CODE' | 'SYNONYM_RULE' | 'ES_BM25' | 'LLM_FALLBACK' | 'UNMATCHED';
export type MatchValidationStatus = 'READY' | 'NEEDS_REVIEW' | 'ERROR';

export interface CandidateOption {
  materialId: string;
  rank: number;
  matchBasis: string;
  reason: string;
}

export interface DocumentReviewRow {
  rowId: string;
  lineNo: number;
  rawCode: string;
  rawName: string;
  rawSpec: string;
  rawUnit: string;
  rawQty: number | string;
  matchMethod: MatchMethod;
  validationStatus: MatchValidationStatus;
  validationMessage?: string;
  selectedMaterialId: string | null;
  confirmedQty: number;
  selected: boolean;
  candidates: CandidateOption[];
}

export interface DocumentAnalysisSession {
  id: string;
  ownerUserId?: string;
  fileName: string;
  fileType: 'XLSX' | 'PDF';
  fileSizeLabel: string;
  uploadedAt: string;
  pipelineSummary: {
    totalRows: number;
    ruleMatched: number;
    esMatched: number;
    llmAssisted: number;
    errorOrUnmatched: number;
  };
  rows: DocumentReviewRow[];
  savedPrNumber?: string;
  savedPrId?: string;
}

export interface RagCitation {
  docTitle: string;
  clause: string;
  effectiveDate: string;
  excerpt: string;
}

export interface ToolResultCard {
  toolName: string;
  summary: string;
  rows?: Array<{ col1: string; col2: string; col3: string; col4?: string }>;
}

export interface AssistantMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  text: string;
  timestamp: string;
  citations?: RagCitation[];
  toolCard?: ToolResultCard;
  linkedDraftId?: string;
  linkedDraftVersion?: number;
  linkedDocSessionId?: string;
  isBlockedNotice?: boolean;
}
