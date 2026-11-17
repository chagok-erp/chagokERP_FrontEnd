import { ApiErrorCode } from '../types/erp';

/**
 * Spring Boot REST API (/api/v1) Contract Adapter Layer
 * Aligned with openapi.yaml (v0.1-draft).
 * Currently backed by in-memory Mock State in ErpContext; replace handlers with fetch/axios calls
 * against Spring Security session cookies + CSRF headers without changing UI components.
 */

export const API_PREFIX = '/api/v1';

export const ERP_API_ENDPOINTS = {
  auth: {
    login: `${API_PREFIX}/auth/login`,
    logout: `${API_PREFIX}/auth/logout`,
    me: `${API_PREFIX}/auth/me`,
  },
  materials: {
    list: `${API_PREFIX}/materials`,
    create: `${API_PREFIX}/materials`,
    update: (id: string) => `${API_PREFIX}/materials/${id}`,
    setActive: (id: string) => `${API_PREFIX}/materials/${id}/active`,
  },
  suppliers: {
    list: `${API_PREFIX}/suppliers`,
    create: `${API_PREFIX}/suppliers`,
    update: (id: string) => `${API_PREFIX}/suppliers/${id}`,
  },
  warehouses: {
    list: `${API_PREFIX}/warehouses`,
    create: `${API_PREFIX}/warehouses`,
    update: (id: string) => `${API_PREFIX}/warehouses/${id}`,
  },
  storageLocations: {
    list: `${API_PREFIX}/storage-locations`,
    create: `${API_PREFIX}/storage-locations`,
    update: (id: string) => `${API_PREFIX}/storage-locations/${id}`,
  },
  purchaseRequisitions: {
    list: `${API_PREFIX}/purchase-requisitions`,
    create: `${API_PREFIX}/purchase-requisitions`,
    detail: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}`,
    patch: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}`,
    submit: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}/submit`,
    rework: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}/rework`,
    approve: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}/approve`,
    reject: (id: string) => `${API_PREFIX}/purchase-requisitions/${id}/reject`,
  },
  purchaseOrders: {
    list: `${API_PREFIX}/purchase-orders`,
    create: `${API_PREFIX}/purchase-orders`,
    detail: (id: string) => `${API_PREFIX}/purchase-orders/${id}`,
  },
  goodsReceipts: {
    list: `${API_PREFIX}/goods-receipts`,
    create: `${API_PREFIX}/goods-receipts`,
    detail: (id: string) => `${API_PREFIX}/goods-receipts/${id}`,
  },
  stock: {
    balances: `${API_PREFIX}/stock-balances`,
    movements: `${API_PREFIX}/stock-movements`,
  },
  auditLogs: {
    list: `${API_PREFIX}/audit-logs`,
  },
  ai: {
    chat: `${API_PREFIX}/assistant/chat`,
    session: (id: string) => `${API_PREFIX}/assistant/sessions/${id}`,
    analyzeDocument: `${API_PREFIX}/documents/analyze`,
    analysisResult: (id: string) => `${API_PREFIX}/documents/analysis/${id}`,
  },
} as const;

export interface ApiErrorResponse {
  code: string;
  message: string;
  traceId: string;
  httpStatus: 401 | 403 | 404 | 409 | 422;
  fieldErrors?: Array<{ field: string; reason: string }>;
}

export function errorCodeToHttpStatus(code?: ApiErrorCode): 401 | 403 | 404 | 409 | 422 | undefined {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'VALIDATION':
      return 422;
    default:
      return undefined;
  }
}

export function formatDecimalQuantity(qty: number, unit: string): string {
  if (unit === 'EA' || unit === 'SET') {
    return String(Math.round(qty));
  }
  return (Math.round(qty * 1000) / 1000).toFixed(3);
}

export function formatMoneyKrw(amount: number): string {
  return String(Math.round(amount));
}

export function generateRequestKey(prefix: 'PR' | 'PO' | 'GR'): string {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REQ-${prefix}-${ts}-${rand}`;
}
