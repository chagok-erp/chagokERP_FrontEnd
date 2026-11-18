import React, { useMemo } from 'react';
import { ArrowRight, BotMessageSquare, PackagePlus } from 'lucide-react';
import { SCREEN_PERMISSIONS } from '../../data/mockData';
import { useErp } from '../../context/ErpContext';
import { AuditLog, Role, ScreenId } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { ScreenStateGate } from '../common/StateOverlay';
import { PoStatusLabel, PrStatusLabel } from '../common/StatusLabel';

// RBAC-MATRIX v0.2 §2: Audit log domain scope per role
const ROLE_AUDIT_DOMAINS: Record<Role, Array<AuditLog['domain']>> = {
  ADMIN: ['PR', 'PO', 'GR', 'MASTER', 'AI'],
  APPROVER: ['PR'],
  PURCHASER: ['PR', 'PO', 'MASTER', 'AI'],
  WAREHOUSE: ['GR', 'MASTER'],
  REQUESTER: ['PR', 'AI'],
};

// Screen Owner: Shared (A/B) | Spec ID: DASH-01, AUD-01
// Future extension slot: Purchase-to-GR pipeline & safety stock comparison chart can be inserted between the 4-column KPI strip and the main operational tables.
export const DashboardScreen: React.FC = () => {
  const {
    currentUser,
    prs,
    pos,
    auditLogs,
    getLowStockMaterials,
    setActiveScreen,
    hasScreenPermission,
  } = useErp();

  const visiblePrs = useMemo(
    () => prs.filter((p) => p.status !== 'DRAFT' || p.requesterId === currentUser?.id),
    [prs, currentUser?.id]
  );

  const visibleAuditLogs = useMemo(() => {
    if (!currentUser) return [];
    const roles = currentUser.roles?.length ? currentUser.roles : [currentUser.role];
    const allowedDomains = new Set(roles.flatMap((r) => ROLE_AUDIT_DOMAINS[r] ?? []));
    return auditLogs.filter((log) => allowedDomains.has(log.domain));
  }, [auditLogs, currentUser]);

  const draftOrSubmittedPrs = visiblePrs.filter((p) => p.status === 'DRAFT' || p.status === 'SUBMITTED').length;
  const pendingApprovals = visiblePrs.filter((p) => p.status === 'SUBMITTED').length;
  const openPos = pos.filter((p) => p.status !== 'RECEIVED').length;
  const lowStockItems = getLowStockMaterials();

  const canViewPr = hasScreenPermission('pr');
  const canViewPo = hasScreenPermission('po');
  const canViewGr = hasScreenPermission('gr');
  const canViewAssistant = hasScreenPermission('assistant');

  const modulesList: Array<{ id: ScreenId; desc: string }> = [
    { id: 'assistant', desc: '대화형 조회·규정 확인 및 구매문서 품목 검토' },
    { id: 'materials', desc: '품목 코드·규격·기준단위·안전재고 관리' },
    { id: 'suppliers', desc: '공급업체 연락처 및 거래 상태 관리' },
    { id: 'warehouses', desc: '창고 및 소속 저장위치 관리' },
    { id: 'pr', desc: '구매요청 초안·제출·반려 재작업 및 이력' },
    { id: 'approvals', desc: '제출된 구매요청 헤더 일괄 승인 및 반려 처리' },
    { id: 'po', desc: '승인 문서 기반 내부 분할 발주 생성 및 인쇄' },
    { id: 'gr', desc: '부분 입고 등록 및 잔량·위치 검증' },
    { id: 'inventory', desc: '창고/위치별 현재고 및 수불 원장 조회' },
  ];

  return (
    <div data-screen-id="SCR-HOME-001" data-spec-id="DASH-01" data-owner="공동">
      <PageHeader
        title="업무 요약"
        subtitle={`${currentUser?.name} (${currentUser?.roleLabel}) 기준 구매·입고·재고 현황`}
        actions={
          <button
            type="button"
            onClick={() => setActiveScreen('assistant')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
          >
            <BotMessageSquare className="w-4 h-4" strokeWidth={1.5} />
            통합 AI Assistant 열기
          </button>
        }
      />

      <ScreenStateGate
        screenId="dashboard"
        emptyTitle="표시할 업무 요약 데이터가 없습니다"
        emptyDescription="신규 구매요청을 작성하거나 통합 AI Assistant에서 문서 분석을 시작해 보세요."
        emptyActionLabel="통합 AI Assistant 열기"
        onEmptyAction={() => setActiveScreen('assistant')}
      >
        <div className="space-y-6">
          {/* 4-Column KPI Strip (clean numeric cards without decorative icons) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveScreen('pr')}
              className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <div className="text-xs font-medium text-slate-500">진행 중 구매요청</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums font-mono">
                {draftOrSubmittedPrs}
                <span className="text-xs font-sans font-normal text-slate-500 ml-1">건</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">초안 및 승인 대기 포함</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveScreen('approvals')}
              className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <div className="text-xs font-medium text-slate-500">승인 대기 건수</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700 tabular-nums font-mono">
                {pendingApprovals}
                <span className="text-xs font-sans font-normal text-slate-500 ml-1">건</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">승인자 결재 대기 문서</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveScreen('po')}
              className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <div className="text-xs font-medium text-slate-500">입고 대기 발주</div>
              <div className="mt-2 text-2xl font-semibold text-blue-700 tabular-nums font-mono">
                {openPos}
                <span className="text-xs font-sans font-normal text-slate-500 ml-1">건</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">부분 입고 포함 미완료 건</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveScreen('inventory')}
              className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <div className="text-xs font-medium text-slate-500">안전재고 미달 품목</div>
              <div className="mt-2 text-2xl font-semibold text-red-700 tabular-nums font-mono">
                {lowStockItems.length}
                <span className="text-xs font-sans font-normal text-slate-500 ml-1">종</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">보충 발주 검토 대상</div>
            </button>
          </div>

          {/* Middle Grid: Low Stock Alerts + Recent Docs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium text-slate-900">안전재고 미달 자재 현황</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    통합 AI Assistant에서 해당 품목들의 구매요청 초안을 생성할 수 있습니다
                  </p>
                </div>
                {canViewAssistant && (
                  <button
                    type="button"
                    onClick={() => setActiveScreen('assistant')}
                    className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                  >
                    AI로 초안 요청
                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">품목코드</th>
                    <th className="py-3 px-4">품목명</th>
                    <th className="py-3 px-4 text-right">현재고</th>
                    <th className="py-3 px-4 text-right">안전재고</th>
                    <th className="py-3 px-4 text-right">부족량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        모든 활성 품목이 안전재고 이상을 유지하고 있습니다
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-slate-700">{m.code}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{m.name}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 font-medium">
                          {m.currentStock.toLocaleString()} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {m.safetyStock.toLocaleString()} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                          -{m.shortage.toLocaleString()} {m.unit}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium text-slate-900">최근 구매·입고 진행 문서</h2>
                {canViewGr && (
                  <button
                    type="button"
                    onClick={() => setActiveScreen('gr')}
                    className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                  >
                    <PackagePlus className="w-4 h-4" strokeWidth={1.5} />
                    입고 등록
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {canViewPo &&
                  pos.slice(0, 2).map((po) => {
                    const totalOrd = po.items.reduce((s, i) => s + i.orderedQty, 0);
                    const totalRec = po.items.reduce((s, i) => s + i.receivedQty, 0);
                    return (
                      <div key={po.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-medium text-slate-900">{po.poNumber}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 truncate">{po.supplierName}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                            누적 입고 {totalRec.toLocaleString()} / 발주 {totalOrd.toLocaleString()}
                          </div>
                        </div>
                        <PoStatusLabel status={po.status} />
                      </div>
                    );
                  })}
                {canViewPr &&
                  visiblePrs.slice(0, 3).map((pr) => (
                    <div key={pr.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-medium text-slate-900">{pr.prNumber}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-700 truncate">{pr.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {pr.requesterName} · {pr.items.length}개 품목 · v{pr.version}
                        </div>
                      </div>
                      <PrStatusLabel status={pr.status} />
                    </div>
                  ))}
                {!canViewPo && !canViewPr && (
                  <div className="px-5 py-10 text-center text-xs text-slate-500">
                    현재 역할에서 조회 가능한 구매요청 또는 발주 문서가 없습니다
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Grid: Audit Trail + Module Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden" data-spec-id="AUD-01">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-slate-900">주요 업무 변경 이력</h2>
                <span className="text-xs text-slate-500">역할 권한 범위 기준 {visibleAuditLogs.length}건</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleAuditLogs.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-500">
                    현재 역할 권한으로 조회할 수 있는 변경 이력이 없습니다
                  </div>
                ) : (
                  visibleAuditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-slate-800">{log.docNumber}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-900">{log.action}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 truncate">{log.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-slate-700">{log.actorName}</div>
                        <div className="text-xs font-mono tabular-nums text-slate-400">{log.timestamp}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-medium text-slate-900">업무 메뉴 바로가기</h2>
                <p className="mt-1 text-xs text-slate-500">현재 로그인 역할에 따라 접근 가능 여부가 표시됩니다</p>
              </div>
              <div className="divide-y divide-slate-100">
                {modulesList.map((mod) => {
                  const meta = SCREEN_PERMISSIONS[mod.id];
                  const allowed = hasScreenPermission(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      data-spec-id={meta.specId}
                      data-owner={meta.owner}
                      onClick={() => setActiveScreen(mod.id)}
                      className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors duration-150 ease-out"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
                          <span>{meta.label}</span>
                          {!allowed && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-amber-700">접근 제한</span>
                            </>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 truncate">{mod.desc}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </ScreenStateGate>
    </div>
  );
};
