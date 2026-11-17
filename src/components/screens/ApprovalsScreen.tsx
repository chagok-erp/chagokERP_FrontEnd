import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { PageHeader } from '../common/AppShell';
import { FormField, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { PrStatusLabel } from '../common/StatusLabel';

// Screen Owner: A | Spec ID: APR-01
export const ApprovalsScreen: React.FC = () => {
  const { prs, currentUser, hasAnyRole, approvePr, rejectPr, pushToast } = useErp();

  const [tab, setTab] = useState<'PENDING' | 'DECIDED'>('PENDING');
  const [selectedPrId, setSelectedPrId] = useState<string>('');
  const [approveComment, setApproveComment] = useState('');

  // Reject Modal
  const [rejectModalPrId, setRejectModalPrId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const canApprove = hasAnyRole(['APPROVER', 'ADMIN']);

  const pendingPrs = useMemo(() => prs.filter((p) => p.status === 'SUBMITTED'), [prs]);
  const decidedPrs = useMemo(
    () => prs.filter((p) => p.status === 'APPROVED' || p.status === 'REJECTED'),
    [prs]
  );

  const list = tab === 'PENDING' ? pendingPrs : decidedPrs;
  const activePr = useMemo(() => list.find((p) => p.id === selectedPrId) || list[0] || null, [list, selectedPrId]);
  const isSelfRequest = Boolean(currentUser && activePr && activePr.requesterId === currentUser.id);

  const handleApprove = (prId: string) => {
    const res = approvePr(prId, approveComment);
    pushToast(res.ok ? 'success' : 'error', res.ok ? '승인 완료' : '승인 실패', res.message);
    if (res.ok) setApproveComment('');
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalPrId) return;
    const res = rejectPr(rejectModalPrId, rejectReason);
    if (!res.ok) {
      setRejectError(res.message);
      return;
    }
    pushToast('info', '구매요청 반려 완료', res.message);
    setRejectModalPrId(null);
    setRejectReason('');
    setRejectError(null);
  };

  return (
    <div data-screen-id="SCR-APR-001" data-spec-id="APR-01" data-owner="A">
      <PageHeader
        title="구매요청 승인함"
        subtitle="제출된 구매요청 헤더 전체에 대한 일괄 승인 및 사유 필수 반려 처리"
      />

      <ScreenStateGate
        screenId="approvals"
        emptyTitle="승인 대기 중인 구매요청이 없습니다"
        emptyDescription="요청자가 구매요청을 제출하면 이 승인함에 표시됩니다."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTab('PENDING')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out ${
                  tab === 'PENDING' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                승인 대기 ({pendingPrs.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('DECIDED')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out ${
                  tab === 'DECIDED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                처리 완료 ({decidedPrs.length})
              </button>
            </div>
            <span className="text-xs text-slate-500">요청 헤더 일괄 승인</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* List */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden self-start">
              {list.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-slate-500">
                  {tab === 'PENDING' ? '현재 승인 대기 건이 없습니다' : '처리 완료된 건이 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {list.map((pr) => {
                    const total = pr.items.reduce((s, i) => s + i.requestedQty * i.estimatedUnitPrice, 0);
                    const isSel = activePr?.id === pr.id;
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => setSelectedPrId(pr.id)}
                        className={`w-full px-5 py-3 text-left transition-colors duration-150 ease-out ${
                          isSel ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium text-slate-900">{pr.prNumber}</span>
                          <PrStatusLabel status={pr.status} />
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-900 line-clamp-1">{pr.title}</div>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {pr.requesterName} · {pr.department}
                          </span>
                          <span className="font-mono tabular-nums font-medium text-slate-700">
                            {total.toLocaleString()}원
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Review Detail */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden self-start">
              {!activePr ? (
                <div className="py-16 text-center text-xs text-slate-500">검토할 구매요청을 선택하세요</div>
              ) : (
                <div>
                  <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-900">{activePr.prNumber}</span>
                        <span>·</span>
                        <span>요청자: {activePr.requesterName} ({activePr.department})</span>
                        <span>·</span>
                        <span>납품 필요일: {activePr.neededByDate || '미지정'}</span>
                      </div>
                      <h2 className="mt-1 text-sm font-medium text-slate-900">{activePr.title}</h2>
                    </div>
                    <PrStatusLabel status={activePr.status} />
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-2 px-3">품목코드</th>
                            <th className="py-2 px-3">품목명 / 규격</th>
                            <th className="py-2 px-3 text-right">요청수량</th>
                            <th className="py-2 px-3 text-right">예상단가</th>
                            <th className="py-2 px-3 text-right">예상금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activePr.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 px-3 font-mono text-slate-700">{item.materialCode}</td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-slate-900">{item.materialName}</div>
                                <div className="text-xs text-slate-500">{item.spec}</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {item.requestedQty.toLocaleString()} {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {item.estimatedUnitPrice.toLocaleString()}원
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                {(item.requestedQty * item.estimatedUnitPrice).toLocaleString()}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {activePr.status === 'SUBMITTED' && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                        {isSelfRequest && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                            업무 분장 원칙(D-02)에 따라 요청자 본인(관리자 포함)이 작성한 구매요청은 직접 승인·반려할 수 없습니다.
                          </div>
                        )}
                        <FormField label="승인 의견 (선택)">
                          <TextInput
                            value={approveComment}
                            disabled={isSelfRequest}
                            onChange={(e) => setApproveComment(e.target.value)}
                            placeholder="예: 안전재고 보충 필요성 확인 완료"
                          />
                        </FormField>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!canApprove || isSelfRequest}
                            onClick={() => {
                              setRejectError(null);
                              setRejectReason('');
                              setRejectModalPrId(activePr.id);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-700 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out"
                          >
                            <XCircle className="w-4 h-4" strokeWidth={1.5} />
                            반려
                          </button>
                          <button
                            type="button"
                            disabled={!canApprove || isSelfRequest}
                            onClick={() => handleApprove(activePr.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out"
                          >
                            <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                            헤더 일괄 승인
                          </button>
                        </div>
                      </div>
                    )}

                    {activePr.rejectionReason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        <strong className="font-medium">반려 사유:</strong> {activePr.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScreenStateGate>

      <Modal
        open={Boolean(rejectModalPrId)}
        onClose={() => setRejectModalPrId(null)}
        title="구매요청 반려 사유 입력"
        subtitle="반려 시 사유 입력이 필수이며 요청자가 수정 후 재제출할 수 있도록 이력이 보존됩니다"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejectModalPrId(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              취소
            </button>
            <button
              type="submit"
              form="reject-pr-form"
              className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors duration-150 ease-out"
            >
              반려 확정
            </button>
          </>
        }
      >
        <form id="reject-pr-form" onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{rejectError}</div>
          )}
          <FormField label="반려 사유" required>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 창고 보유 재고 우선 소진 필요, 수량 조정 후 재요청 요망"
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
};
