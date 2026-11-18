import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileEdit, Plus, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { PrStatus, PurchaseRequisition } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { FormField, SearchToolbar, SelectInput, SortableHeader, SortDirection, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { PoStatusLabel, PrStatusLabel } from '../common/StatusLabel';

type PrSortKey = 'prNumber' | 'title' | 'requesterName' | 'totalAmount' | 'status';

// Screen Owner: A | Spec ID: PR-01, PR-02
const SOURCE_LABEL: Record<PurchaseRequisition['source'], string> = {
  UI: '직접 작성',
  AGENT: 'AI 대화 생성',
  DOCUMENT_AI: '문서 분석 생성',
};

export const PrScreen: React.FC = () => {
  const {
    prs,
    pos,
    materials,
    currentUser,
    hasAnyRole,
    getPrItemOrderStats,
    savePrDraft,
    submitPr,
    reworkRejectedPr,
    pushToast,
    setActiveScreen,
  } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PrStatus>('ALL');
  const [sortKey, setSortKey] = useState<PrSortKey>('prNumber');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedPrId, setSelectedPrId] = useState<string>(prs[0]?.id ?? '');

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPr, setEditingPr] = useState<PurchaseRequisition | null>(null);
  const [title, setTitle] = useState('');
  const [neededByDate, setNeededByDate] = useState('');
  const [draftLines, setDraftLines] = useState<Array<{ materialId: string; requestedQty: number }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const activeMaterials = useMemo(() => materials.filter((m) => m.active), [materials]);
  const canCreate = hasAnyRole(['REQUESTER', 'PURCHASER', 'ADMIN']);

  const toggleSort = (key: PrSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'prNumber' ? 'desc' : 'asc');
    }
  };

  // RBAC-MATRIX v0.2: Other users' DRAFT PRs are hidden from everyone (including ADMIN)
  const visiblePrs = useMemo(
    () => prs.filter((pr) => pr.status !== 'DRAFT' || pr.requesterId === currentUser?.id),
    [prs, currentUser?.id]
  );

  const filtered = useMemo(() => {
    const base = visiblePrs.filter((pr) => {
      if (statusFilter !== 'ALL' && pr.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        pr.prNumber.toLowerCase().includes(q) ||
        pr.title.toLowerCase().includes(q) ||
        pr.requesterName.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case 'prNumber':
          return a.prNumber.localeCompare(b.prNumber) * dir;
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'requesterName':
          return a.requesterName.localeCompare(b.requesterName) * dir;
        case 'totalAmount': {
          const sumA = a.items.reduce((s, i) => s + i.requestedQty * i.estimatedUnitPrice, 0);
          const sumB = b.items.reduce((s, i) => s + i.requestedQty * i.estimatedUnitPrice, 0);
          return (sumA - sumB) * dir;
        }
        case 'status':
          return a.status.localeCompare(b.status) * dir;
      }
    });
  }, [visiblePrs, search, statusFilter, sortKey, sortDir]);

  const selectedPr = useMemo(
    () => visiblePrs.find((p) => p.id === selectedPrId) || filtered[0] || null,
    [visiblePrs, selectedPrId, filtered]
  );

  const linkedPos = useMemo(
    () => (selectedPr ? pos.filter((po) => po.sourcePrId === selectedPr.id) : []),
    [pos, selectedPr]
  );

  const openNewModal = () => {
    setEditingPr(null);
    setTitle('');
    setNeededByDate('');
    setDraftLines([{ materialId: activeMaterials[0]?.id ?? '', requestedQty: 10 }]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (pr: PurchaseRequisition) => {
    setEditingPr(pr);
    setTitle(pr.title);
    setNeededByDate(pr.neededByDate ?? '');
    setDraftLines(pr.items.map((i) => ({ materialId: i.materialId, requestedQty: i.requestedQty })));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const res = savePrDraft({
      draftId: editingPr?.id,
      expectedVersion: editingPr?.version,
      title,
      neededByDate,
      source: 'UI',
      items: draftLines,
    });
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    pushToast('success', editingPr ? '구매요청 초안 수정 완료' : '구매요청 초안 생성 완료', res.message);
    if (res.data) setSelectedPrId(res.data.id);
    setModalOpen(false);
  };

  const handleSubmitPr = (prId: string) => {
    const res = submitPr(prId);
    pushToast(res.ok ? 'success' : 'error', res.ok ? '구매요청 제출 완료' : '제출 불가', res.message);
  };

  const handleReworkPr = (prId: string) => {
    const res = reworkRejectedPr(prId);
    pushToast(res.ok ? 'info' : 'error', res.ok ? '재작업 전환 완료' : '전환 불가', res.message);
  };

  // RBAC-MATRIX v0.2: Strict ownership check (no ADMIN bypass for PR edit/submit/rework)
  const isOwner = (pr: PurchaseRequisition) => Boolean(currentUser && currentUser.id === pr.requesterId);

  return (
    <div data-screen-id="SCR-PR-001" data-spec-id="PR-01 / PR-02" data-owner="A">
      <PageHeader
        title="구매요청 관리"
        subtitle="직접 작성·AI 대화·문서 분석으로 생성된 구매요청 초안 및 제출 이력 관리"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveScreen('assistant')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0"
            >
              AI로 초안 작성
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              신규 요청 작성
            </button>
          </div>
        }
      />

      <ScreenStateGate
        screenId="pr"
        emptyTitle="등록된 구매요청이 없습니다"
        emptyDescription="신규 요청을 직접 작성하거나 통합 AI Assistant를 통해 초안을 생성할 수 있습니다."
        emptyActionLabel="신규 요청 작성"
        onEmptyAction={openNewModal}
      >
        <div className="space-y-4">
          <SearchToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="요청번호, 제목, 요청자 검색"
            leftSlot={
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                      statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL'
                      ? '전체'
                      : st === 'DRAFT'
                        ? '초안'
                        : st === 'SUBMITTED'
                          ? '승인대기'
                          : st === 'APPROVED'
                            ? '승인됨'
                            : '반려됨'}
                  </button>
                ))}
              </div>
            }
            rightSlot={<span className="text-xs text-slate-500 tabular-nums">총 {filtered.length}건</span>}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PR List Table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-PR-001">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">
                        <SortableHeader label="요청번호" active={sortKey === 'prNumber'} direction={sortDir} onClick={() => toggleSort('prNumber')} />
                      </th>
                      <th className="py-3 px-4">
                        <SortableHeader label="요청 제목" active={sortKey === 'title'} direction={sortDir} onClick={() => toggleSort('title')} />
                      </th>
                      <th className="py-3 px-4">
                        <SortableHeader label="요청자" active={sortKey === 'requesterName'} direction={sortDir} onClick={() => toggleSort('requesterName')} />
                      </th>
                      <th className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <SortableHeader label="예상금액" active={sortKey === 'totalAmount'} direction={sortDir} onClick={() => toggleSort('totalAmount')} align="right" />
                        </div>
                      </th>
                      <th className="py-3 px-4">
                        <SortableHeader label="상태" active={sortKey === 'status'} direction={sortDir} onClick={() => toggleSort('status')} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          조건에 맞는 구매요청이 없습니다
                        </td>
                      </tr>
                    ) : (
                      filtered.map((pr) => {
                        const total = pr.items.reduce((s, i) => s + i.requestedQty * i.estimatedUnitPrice, 0);
                        const isSel = selectedPr?.id === pr.id;
                        return (
                          <tr
                            key={pr.id}
                            onClick={() => setSelectedPrId(pr.id)}
                            className={`cursor-pointer transition-colors duration-150 ease-out ${
                              isSel ? 'bg-slate-100' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                              {pr.prNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900 line-clamp-1">{pr.title}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {SOURCE_LABEL[pr.source]} · {pr.items.length}개 품목 · v{pr.version}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{pr.requesterName}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {total.toLocaleString()}원
                            </td>
                            <td className="py-3 px-4">
                              <PrStatusLabel status={pr.status} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PR Detail Panel */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-PR-003">
              {!selectedPr ? (
                <div className="p-8 text-center text-xs text-slate-500">좌측 목록에서 구매요청을 선택하세요</div>
              ) : (
                <div>
                  <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-900">{selectedPr.prNumber}</span>
                        <span>·</span>
                        <span>v{selectedPr.version}</span>
                        <span>·</span>
                        <span>{SOURCE_LABEL[selectedPr.source]}</span>
                      </div>
                      <h2 className="mt-1 text-sm font-medium text-slate-900">{selectedPr.title}</h2>
                      <div className="mt-1 text-xs text-slate-500">
                        요청자: {selectedPr.requesterName} ({selectedPr.department}) · 필요일:{' '}
                        {selectedPr.neededByDate || '미지정 (제출 전 입력 필요)'}
                      </div>
                    </div>
                    <PrStatusLabel status={selectedPr.status} />
                  </div>

                  {/* Rejection Reason Notice */}
                  {selectedPr.status === 'REJECTED' && selectedPr.rejectionReason && (
                    <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                      <div className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        승인자 반려 사유
                      </div>
                      <p className="mt-1 leading-relaxed">{selectedPr.rejectionReason}</p>
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="p-5">
                    <div className="text-xs font-medium text-slate-800 mb-2">요청 품목 내역</div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-2 px-3">품목</th>
                            <th className="py-2 px-3 text-right">요청수량</th>
                            {selectedPr.status === 'APPROVED' && (
                              <th className="py-2 px-3 text-right">미발주 잔량</th>
                            )}
                            <th className="py-2 px-3 text-right">예상금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPr.items.map((item) => {
                            const orderStats =
                              selectedPr.status === 'APPROVED'
                                ? getPrItemOrderStats(selectedPr.id, item.id)
                                : null;
                            return (
                              <tr key={item.id}>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-slate-900">{item.materialName}</div>
                                  <div className="text-xs font-mono text-slate-500">
                                    {item.materialCode} · {item.spec}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                  {item.requestedQty.toLocaleString()} {item.unit}
                                </td>
                                {orderStats && (
                                  <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                    <span
                                      className={
                                        orderStats.remainingToOrder > 0
                                          ? 'font-medium text-blue-700'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {orderStats.remainingToOrder.toLocaleString()} {item.unit}
                                    </span>
                                  </td>
                                )}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                  {(item.requestedQty * item.estimatedUnitPrice).toLocaleString()}원
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {selectedPr.status === 'APPROVED' && linkedPos.length > 0 && (
                      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                        <div className="text-xs font-medium text-slate-800">
                          연결된 내부 발주서 ({linkedPos.length}건)
                        </div>
                        <div className="space-y-2">
                          {linkedPos.map((po) => {
                            const poAmt = po.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
                            return (
                              <div
                                key={po.id}
                                className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <span className="font-mono font-medium text-slate-900">{po.poNumber}</span>
                                  <span className="text-slate-400 mx-1">·</span>
                                  <span className="text-slate-700">{po.supplierName}</span>
                                  <span className="text-slate-400 mx-1">·</span>
                                  <span className="font-mono tabular-nums text-slate-600">
                                    {poAmt.toLocaleString()}원
                                  </span>
                                </div>
                                <PoStatusLabel status={po.status} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {selectedPr.status === 'DRAFT' && isOwner(selectedPr) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(selectedPr)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
                          >
                            <FileEdit className="w-4 h-4" strokeWidth={1.5} />
                            초안 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitPr(selectedPr.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
                          >
                            <Send className="w-4 h-4" strokeWidth={1.5} />
                            승인 요청 제출
                          </button>
                        </>
                      )}

                      {selectedPr.status === 'REJECTED' && isOwner(selectedPr) && (
                        <button
                          type="button"
                          onClick={() => handleReworkPr(selectedPr.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
                        >
                          <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
                          초안으로 재작업 시작
                        </button>
                      )}

                      {selectedPr.status === 'SUBMITTED' && (
                        <button
                          type="button"
                          onClick={() => setActiveScreen('approvals')}
                          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg transition-colors duration-150 ease-out"
                        >
                          승인함에서 검토하기
                        </button>
                      )}

                      {selectedPr.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setActiveScreen('po')}
                          className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors duration-150 ease-out"
                        >
                          구매발주 화면으로 이동
                        </button>
                      )}
                    </div>

                    {/* Audit History */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <div className="text-xs font-medium text-slate-800 mb-3">문서 상태 이력</div>
                      <ul className="space-y-3">
                        {selectedPr.history.map((h) => (
                          <li key={h.id} className="text-xs flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-medium text-slate-700">{h.action}</span>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="text-slate-800">{h.actorName}</span>
                              {h.comment && <p className="text-slate-500 mt-1">{h.comment}</p>}
                            </div>
                            <span className="font-mono tabular-nums text-slate-400 shrink-0">{h.timestamp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScreenStateGate>

      {/* Create / Edit PR Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPr ? `구매요청 초안 수정 (${editingPr.prNumber} · v${editingPr.version})` : '신규 구매요청 초안 작성'}
        subtitle="활성 품목만 선택 가능하며 수량은 0보다 커야 합니다"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              취소
            </button>
            <button
              type="submit"
              form="pr-draft-form"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
            >
              초안 저장
            </button>
          </>
        }
      >
        <form id="pr-draft-form" data-screen-id="SCR-PR-002" onSubmit={handleSaveDraft} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <FormField label="요청 제목" required>
                <TextInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: B라인 서보모터 및 근접센서 보충 요청"
                />
              </FormField>
            </div>
            <FormField label="납품 필요일" hint="초안 선택, 제출 시 필수">
              <TextInput type="date" value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)} />
            </FormField>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">요청 품목 목록 (동일 품목 중복 추가 불가)</span>
              <button
                type="button"
                disabled={draftLines.length >= activeMaterials.length}
                onClick={() => {
                  const usedIds = new Set(draftLines.map((l) => l.materialId));
                  const nextMat = activeMaterials.find((m) => !usedIds.has(m.id));
                  if (!nextMat) {
                    setFormError('추가 가능한 활성 품목이 모두 목록에 포함되어 있습니다.');
                    return;
                  }
                  setFormError(null);
                  setDraftLines((prev) => [...prev, { materialId: nextMat.id, requestedQty: 1 }]);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} />
                품목 행 추가
              </button>
            </div>

            <div className="space-y-2">
              {draftLines.map((line, idx) => {
                const mat = materials.find((m) => m.id === line.materialId);
                const otherSelectedIds = new Set(
                  draftLines.filter((_, i) => i !== idx).map((l) => l.materialId)
                );
                const isIntUnit = mat?.unit === 'EA' || mat?.unit === 'SET';
                return (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}.</span>
                    <div className="flex-1">
                      <SelectInput
                        value={line.materialId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          if (otherSelectedIds.has(nextId)) {
                            setFormError('같은 구매요청에 동일 품목을 중복 추가할 수 없습니다.');
                            return;
                          }
                          setFormError(null);
                          setDraftLines((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, materialId: nextId } : item))
                          );
                        }}
                      >
                        {activeMaterials.map((m) => {
                          const usedElsewhere = otherSelectedIds.has(m.id);
                          return (
                            <option key={m.id} value={m.id} disabled={usedElsewhere}>
                              [{m.code}] {m.name} ({m.unit}) {usedElsewhere ? '— 이미 선택됨' : ''}
                            </option>
                          );
                        })}
                      </SelectInput>
                    </div>
                    <div className="w-28">
                      <TextInput
                        type="number"
                        min={isIntUnit ? 1 : 0.001}
                        step={isIntUnit ? 1 : '0.001'}
                        value={line.requestedQty}
                        onChange={(e) =>
                          setDraftLines((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, requestedQty: Number(e.target.value) } : item
                            )
                          )
                        }
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-9">{mat?.unit ?? 'EA'}</span>
                    <button
                      type="button"
                      disabled={draftLines.length <= 1}
                      onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                      aria-label="행 삭제"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
