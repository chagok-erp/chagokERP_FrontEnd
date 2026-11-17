import React from 'react';
import { AlertCircle, FolderOpen, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { MOCK_USERS, SCREEN_PERMISSIONS } from '../../data/mockData';
import { useErp } from '../../context/ErpContext';
import { ScreenId } from '../../types/erp';

export const LoadingSkeletonView: React.FC<{ rows?: number; title?: string }> = ({
  rows = 6,
  title = '데이터를 불러오는 중입니다',
}) => {
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      role="status"
      aria-label={title}
    >
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="h-7 w-28 bg-slate-200 rounded-lg animate-pulse" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="px-6 py-3 flex items-center gap-4">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse shrink-0" />
            <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse shrink-0" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const EmptyStateView: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({
  title = '표시할 데이터가 없습니다',
  description = '조건에 맞는 항목이 없거나 아직 등록된 문서가 없습니다.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3">
        <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 max-w-md leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const ErrorStateView: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({
  title = '데이터를 불러오지 못했습니다',
  description = '일시적인 통신 지연 또는 조회 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  onRetry,
}) => {
  return (
    <div className="bg-white border border-red-200 rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700 mb-3">
        <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-600 max-w-md leading-relaxed">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          다시 시도
        </button>
      )}
    </div>
  );
};

export const ForbiddenStateView: React.FC<{
  screenId: ScreenId;
  customMessage?: string;
}> = ({ screenId, customMessage }) => {
  const { currentUser, loginAs, setActiveScreen, setViewStateMode } = useErp();
  const perm = SCREEN_PERMISSIONS[screenId];
  const authorizedUsers = MOCK_USERS.filter((u) => perm.roles.includes(u.role));

  return (
    <div className="bg-white border border-amber-200 rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
        <Lock className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium text-slate-900">접근 권한이 제한된 화면입니다</h3>
      <p className="mt-2 text-xs text-slate-600 max-w-lg leading-relaxed">
        {customMessage ||
          `[${perm.label}] 메뉴는 지정된 업무 역할만 접근할 수 있습니다. 현재 로그인된 계정(${currentUser?.roleLabel ?? '미인증'})으로는 열람 및 실행이 제한됩니다.`}
      </p>

      <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-center gap-3">
        <span>
          허용 역할:{' '}
          <strong className="font-medium text-slate-900">
            {authorizedUsers.length > 0
              ? authorizedUsers.map((u) => u.roleLabel).join(', ')
              : perm.roles.join(', ')}
          </strong>
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span>
          현재 역할: <strong className="font-medium text-amber-700">{currentUser?.roleLabel}</strong>
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {authorizedUsers.slice(0, 2).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              loginAs(u.id);
              setViewStateMode('normal');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
            {u.name}({u.roleLabel})로 전환
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setViewStateMode('normal');
            setActiveScreen('dashboard');
          }}
          className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          업무 요약으로 이동
        </button>
      </div>
    </div>
  );
};

export const ScreenStateGate: React.FC<{
  screenId: ScreenId;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  children: React.ReactNode;
}> = ({
  screenId,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  children,
}) => {
  const { viewStateMode, setViewStateMode, hasScreenPermission } = useErp();

  if (!hasScreenPermission(screenId) || viewStateMode === 'forbidden') {
    return <ForbiddenStateView screenId={screenId} />;
  }
  if (viewStateMode === 'loading') {
    return <LoadingSkeletonView />;
  }
  if (viewStateMode === 'error') {
    return <ErrorStateView onRetry={() => setViewStateMode('normal')} />;
  }
  if (viewStateMode === 'empty') {
    return (
      <EmptyStateView
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction || (() => setViewStateMode('normal'))}
      />
    );
  }

  return <>{children}</>;
};
