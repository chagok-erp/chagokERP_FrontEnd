import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  PackageCheck,
  PackageOpen,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { MatchValidationStatus, PoStatus, PrStatus } from '../../types/erp';

export const PrStatusLabel: React.FC<{ status: PrStatus }> = ({ status }) => {
  switch (status) {
    case 'DRAFT':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 whitespace-nowrap">
          <FileEdit className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          초안
        </span>
      );
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          승인 대기
        </span>
      );
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          승인 완료
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          반려됨
        </span>
      );
  }
};

export const PoStatusLabel: React.FC<{ status: PoStatus }> = ({ status }) => {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 whitespace-nowrap">
          <PackageOpen className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          입고 대기
        </span>
      );
    case 'PARTIALLY_RECEIVED':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          부분 입고
        </span>
      );
    case 'RECEIVED':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <PackageCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          입고 완료
        </span>
      );
  }
};

export const ActiveStatusLabel: React.FC<{ active: boolean }> = ({ active }) =>
  active ? (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 whitespace-nowrap">
      <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
      사용중
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 whitespace-nowrap">
      <XCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
      비활성
    </span>
  );

export const MatchValidationLabel: React.FC<{ status: MatchValidationStatus }> = ({ status }) => {
  switch (status) {
    case 'READY':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          확정 가능
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          검토 필요
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-red-700 whitespace-nowrap">
          <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          오류 차단
        </span>
      );
  }
};
