import React from 'react';
import {
  AlertCircle,
  BotMessageSquare,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  PackagePlus,
  ShoppingCart,
  Warehouse,
  X,
} from 'lucide-react';
import { MOCK_USERS, SCREEN_PERMISSIONS } from '../../data/mockData';
import { useErp } from '../../context/ErpContext';
import { ScreenId, ViewStateMode } from '../../types/erp';

interface NavGroup {
  groupLabel: string;
  items: Array<{
    id: ScreenId;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badgeCount?: number;
  }>;
}

const STATE_OPTIONS: Array<{ id: ViewStateMode; label: string }> = [
  { id: 'normal', label: '정상' },
  { id: 'loading', label: '로딩' },
  { id: 'empty', label: '빈 데이터' },
  { id: 'error', label: '오류' },
  { id: 'forbidden', label: '권한 제한' },
];

export const PageHeader: React.FC<{
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => {
  const { viewStateMode, setViewStateMode } = useErp();

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div
          className="flex items-center gap-1 p-1 bg-slate-200/70 border border-slate-200 rounded-lg"
          role="group"
          aria-label="화면 상태 전환"
        >
          <span className="px-2 text-xs font-medium text-slate-600 whitespace-nowrap">화면 상태</span>
          {STATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setViewStateMode(opt.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${
                viewStateMode === opt.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    activeScreen,
    setActiveScreen,
    loginAs,
    logout,
    hasScreenPermission,
    prs,
    pos,
    toasts,
    dismissToast,
  } = useErp();

  const pendingApprovalsCount = prs.filter((p) => p.status === 'SUBMITTED').length;
  const openPosCount = pos.filter((p) => p.status !== 'RECEIVED').length;

  const navGroups: NavGroup[] = [
    {
      groupLabel: '워크스페이스',
      items: [
        { id: 'dashboard', label: '업무 요약', icon: LayoutDashboard },
        { id: 'assistant', label: '통합 AI Assistant', icon: BotMessageSquare },
      ],
    },
    {
      groupLabel: '기준정보',
      items: [
        { id: 'materials', label: '품목 마스터', icon: Package },
        { id: 'suppliers', label: '공급업체 관리', icon: Building2 },
        { id: 'warehouses', label: '창고·저장위치', icon: Warehouse },
      ],
    },
    {
      groupLabel: '구매 관리',
      items: [
        { id: 'pr', label: '구매요청', icon: FileText },
        { id: 'approvals', label: '승인함', icon: ClipboardCheck, badgeCount: pendingApprovalsCount },
        { id: 'po', label: '구매발주', icon: ShoppingCart, badgeCount: openPosCount },
      ],
    },
    {
      groupLabel: '입고·재고 관리',
      items: [
        { id: 'gr', label: '입고 등록', icon: PackagePlus },
        { id: 'inventory', label: '재고·수불 원장', icon: Boxes },
      ],
    },
  ];

  const currentMeta = SCREEN_PERMISSIONS[activeScreen];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Fixed Left Sidebar (256px) */}
      <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-200 flex flex-col border-r border-slate-800 select-none">
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveScreen('dashboard')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
          >
            <span className="text-base font-semibold tracking-tight text-white">차곡ERP</span>
          </button>
          <span className="text-xs text-slate-400 font-normal">구매·재고</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="주 메뉴">
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupLabel} className={groupIdx > 0 ? 'mt-6' : ''}>
              <div className="px-3 mb-2 text-xs font-medium text-slate-400">
                {group.groupLabel}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeScreen === item.id;
                  const allowed = hasScreenPermission(item.id);
                  const meta = SCREEN_PERMISSIONS[item.id];

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-spec-id={meta.specId}
                        data-owner={meta.owner}
                        onClick={() => setActiveScreen(item.id)}
                        className={`w-full h-9 flex items-center justify-between gap-2 px-3 rounded-lg text-xs font-medium transition-colors duration-150 ease-out whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                          isActive
                            ? 'bg-brand-600 text-white'
                            : allowed
                              ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                              : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-4 h-4 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" strokeWidth={1.5} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {!allowed && (
                            <Lock className="w-4 h-4 text-slate-500" strokeWidth={1.5} aria-label="권한 제한" />
                          )}
                          {item.badgeCount !== undefined && item.badgeCount > 0 && (
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                isActive ? 'text-brand-100' : 'text-slate-400'
                              }`}
                            >
                              {item.badgeCount}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile Summary */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="text-xs font-medium text-white truncate">
            {currentUser?.name} · {currentUser?.roleLabel}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate font-mono">
            {currentUser?.department} · {currentUser?.empNo}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header (3-zone contract, h-14) */}
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Contextual Breadcrumb (developer spec/owner exposed only via data attributes) */}
          <div
            className="flex items-center gap-2 text-xs text-slate-500 min-w-0 whitespace-nowrap"
            data-spec-id={currentMeta.specId}
            data-owner={currentMeta.owner}
          >
            <span className="font-medium text-slate-800">차곡제조</span>
            <span aria-hidden="true">/</span>
            <span className="text-slate-700 font-medium truncate">{currentMeta.label}</span>
          </div>

          {/* Zone 2 & 3: Role Switcher + Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <label htmlFor="role-switcher" className="text-xs text-slate-500 whitespace-nowrap">
              역할 전환
            </label>
            <select
              id="role-switcher"
              value={currentUser?.id ?? ''}
              onChange={(e) => loginAs(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600"
            >
              {MOCK_USERS.length === 0 ? (
                <option value={currentUser?.id ?? ''}>
                  {currentUser ? `${currentUser.name} (${currentUser.roleLabel})` : '계정 없음'}
                </option>
              ) : (
                MOCK_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.roleLabel})
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              로그아웃
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main
          className="flex-1 overflow-y-auto p-6"
          data-active-screen={activeScreen}
          data-spec-id={currentMeta.specId}
          data-owner={currentMeta.owner}
        >
          <div className="max-w-[1360px] mx-auto">{children}</div>
        </main>
      </div>

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-16 right-6 z-50 space-y-2 w-96 max-w-[calc(100vw-2rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              className={`p-4 rounded-xl border shadow-md bg-white flex items-start gap-3 ${
                t.type === 'error'
                  ? 'border-red-300 text-red-700'
                  : t.type === 'success'
                    ? 'border-emerald-300 text-emerald-700'
                    : 'border-slate-300 text-brand-600'
              }`}
            >
              {t.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900">{t.title}</p>
                {t.detail && <p className="mt-1 text-xs text-slate-600 leading-relaxed">{t.detail}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="알림 닫기"
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
