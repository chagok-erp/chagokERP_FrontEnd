import React, { useMemo, useState } from 'react';
import { Info, PackagePlus, Plus, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { generateRequestKey } from '../../services/erpApi';
import { PoStatus, PurchaseOrder } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { FormField, SearchToolbar, SelectInput, SortableHeader, SortDirection, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { PoStatusLabel } from '../common/StatusLabel';

type PoSortKey = 'poNumber' | 'supplierName' | 'totalAmount' | 'status';

// Screen Owner: A | Spec ID: PO-01, PO-02, PO-03 (D-01: 1 PR -> N PO Split Order)
export const PoScreen: React.FC = () => {
  const {
    pos,
    prs,
    suppliers,
    hasAnyRole,
    hasScreenPermission,
    navigateToGrWithPo,
    getPrItemOrderStats,
    hasPrRemainingToOrder,
    createPoFromPr,
    pushToast,
  } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PoStatus>('ALL');
  const [sortKey, setSortKey] = useState<PoSortKey>('poNumber');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedPoId, setSelectedPoId] = useState<string>(pos[0]?.id ?? '');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printPo, setPrintPo] = useState<PurchaseOrder | null>(null);

  // D-01: Approved PRs that have at least one item with remaining-to-order > 0
  const approvedPrsWithRemaining = useMemo(
    () => prs.filter((pr) => pr.status === 'APPROVED' && hasPrRemainingToOrder(pr.id)),
    [prs, hasPrRemainingToOrder]
  );
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active), [suppliers]);

  const [selectedPrId, setSelectedPrId] = useState<string>(approvedPrsWithRemaining[0]?.id ?? '');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(activeSuppliers[0]?.id ?? '');
  const [poRequestId, setPoRequestId] = useState<string>(() => generateRequestKey('PO'));
  const [poNote, setPoNote] = useState('');
  const [allocQtyMap, setAllocQtyMap] = useState<Record<string, number>>({});
  const [unitPriceMap, setUnitPriceMap] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);
  const [lastPoSubmit, setLastPoSubmit] = useState<{
    requestId: string;
    prId: string;
    supplierId: string;
    note?: string;
    lines: Array<{ prItemId: string; orderedQty: number; unitPrice?: number }>;
  } | null>(null);

  const canCreatePo = hasAnyRole(['PURCHASER', 'ADMIN']);

  const toggleSort = (key: PoSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'poNumber' ? 'desc' : 'asc');
    }
  };

  const filteredPos = useMemo(() => {
    const base = pos.filter((po) => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        po.poNumber.toLowerCase().includes(q) ||
        po.sourcePrNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case 'poNumber':
          return a.poNumber.localeCompare(b.poNumber) * dir;
        case 'supplierName':
          return a.supplierName.localeCompare(b.supplierName) * dir;
        case 'totalAmount': {
          const sumA = a.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
          const sumB = b.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
          return (sumA - sumB) * dir;
        }
        case 'status':
          return a.status.localeCompare(b.status) * dir;
      }
    });
  }, [pos, search, statusFilter, sortKey, sortDir]);

  const activePo = useMemo(
    () => pos.find((p) => p.id === selectedPoId) || filteredPos[0] || null,
    [pos, selectedPoId, filteredPos]
  );

  // Sibling POs created from the same PR (for split-PO navigation)
  const siblingPos = useMemo(() => {
    if (!activePo) return [];
    return pos.filter((p) => p.sourcePrId === activePo.sourcePrId && p.id !== activePo.id);
  }, [pos, activePo]);

  const selectedModalPr = useMemo(
    () => approvedPrsWithRemaining.find((p) => p.id === selectedPrId) || approvedPrsWithRemaining[0] || null,
    [approvedPrsWithRemaining, selectedPrId]
  );

  const initAllocationForPr = (prId: string) => {
    const targetPr = approvedPrsWithRemaining.find((p) => p.id === prId);
    if (!targetPr) {
      setAllocQtyMap({});
      setUnitPriceMap({});
      return;
    }
    const nextQty: Record<string, number> = {};
    const nextPrice: Record<string, number> = {};
    for (const item of targetPr.items) {
      const stats = getPrItemOrderStats(targetPr.id, item.id);
      nextQty[item.id] = stats.remainingToOrder;
      nextPrice[item.id] = item.estimatedUnitPrice;
    }
    setAllocQtyMap(nextQty);
    setUnitPriceMap(nextPrice);
  };

  const handleOpenCreateModal = () => {
    const firstPr = approvedPrsWithRemaining[0];
    const nextPrId = firstPr?.id ?? '';
    setSelectedPrId(nextPrId);
    setSelectedSupplierId(activeSuppliers[0]?.id ?? '');
    setPoRequestId(generateRequestKey('PO'));
    setPoNote('');
    setFormError(null);
    setConflictError(false);
    initAllocationForPr(nextPrId);
    setCreateModalOpen(true);
  };

  const handleSelectPrChange = (nextPrId: string) => {
    setSelectedPrId(nextPrId);
    setFormError(null);
    setConflictError(false);
    initAllocationForPr(nextPrId);
  };

  const handleRecoverPoConflict = () => {
    if (selectedModalPr) {
      initAllocationForPr(selectedModalPr.id);
    }
    setPoRequestId(generateRequestKey('PO'));
    setFormError(null);
    setConflictError(false);
  };

  const submitCreatePo = (payload: {
    requestId: string;
    prId: string;
    supplierId: string;
    note?: string;
    lines: Array<{ prItemId: string; orderedQty: number; unitPrice?: number }>;
  }) => {
    const res = createPoFromPr(payload);
    if (!res.ok) {
      setFormError(res.message);
      setConflictError(res.errorCode === 'CONFLICT');
      return;
    }
    setConflictError(false);
    if (res.idempotentReplay) {
      pushToast('info', '동일 발주 요청 재시도 (기존 발주 반환)', res.message);
    } else {
      pushToast('success', '내부 발주서 생성 완료', res.message);
      setLastPoSubmit(payload);
    }
    if (res.data) setSelectedPoId(res.data.id);
    setCreateModalOpen(false);
  };

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalPr) return;
    const lines = selectedModalPr.items.map((item) => ({
      prItemId: item.id,
      orderedQty: Number(allocQtyMap[item.id] ?? 0),
      unitPrice: Number(unitPriceMap[item.id] ?? item.estimatedUnitPrice),
    }));
    submitCreatePo({
      requestId: poRequestId,
      prId: selectedModalPr.id,
      supplierId: selectedSupplierId,
      note: poNote,
      lines,
    });
  };

  const modalOrderTotal = useMemo(() => {
    if (!selectedModalPr) return 0;
    return selectedModalPr.items.reduce((sum, item) => {
      const qty = Number(allocQtyMap[item.id] ?? 0);
      const price = Number(unitPriceMap[item.id] ?? item.estimatedUnitPrice);
      return sum + (qty > 0 && price >= 0 ? qty * price : 0);
    }, 0);
  }, [selectedModalPr, allocQtyMap, unitPriceMap]);

  return (
    <div data-screen-id="SCR-PO-001" data-spec-id="PO-01 / PO-02 / PO-03" data-owner="A">
      <PageHeader
        title="내부 구매발주"
        subtitle="승인된 구매요청의 품목별 미발주 잔량 기준 분할 발주 생성 및 인쇄"
        actions={
          <button
            type="button"
            disabled={!canCreatePo}
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            승인 요청으로 발주 생성 ({approvedPrsWithRemaining.length})
          </button>
        }
      />

      <ScreenStateGate
        screenId="po"
        emptyTitle="생성된 내부 구매발주가 없습니다"
        emptyDescription="승인 완료된 구매요청을 선택하여 첫 내부 발주서를 생성해 주세요."
        emptyActionLabel="승인 요청으로 발주 생성"
        onEmptyAction={handleOpenCreateModal}
      >
        <div className="space-y-4">
          <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
              <span>
                외부 주문 전송 및 결제를 수행하지 않는 내부 발주 문서이며, 승인된 구매요청 1건에서 공급업체별·수량별로 여러 발주서를 분할 생성할 수 있습니다
              </span>
            </div>
            {lastPoSubmit && canCreatePo && (
              <button
                type="button"
                onClick={() => submitCreatePo(lastPoSubmit)}
                className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
                직전 발주 키({lastPoSubmit.requestId}) 재전송 확인
              </button>
            )}
          </div>

          <SearchToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="발주번호, 원본 요청번호, 공급업체명 검색"
            leftSlot={
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED'] as const).map((st) => (
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
                      : st === 'OPEN'
                        ? '입고 대기'
                        : st === 'PARTIALLY_RECEIVED'
                          ? '부분 입고'
                          : '입고 완료'}
                  </button>
                ))}
              </div>
            }
            rightSlot={<span className="text-xs text-slate-500 tabular-nums">총 {filteredPos.length}건</span>}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PO Table */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-PO-001">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">
                      <SortableHeader label="발주번호" active={sortKey === 'poNumber'} direction={sortDir} onClick={() => toggleSort('poNumber')} />
                    </th>
                    <th className="py-3 px-4">
                      <SortableHeader label="공급업체" active={sortKey === 'supplierName'} direction={sortDir} onClick={() => toggleSort('supplierName')} />
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <SortableHeader label="예상 발주총액" active={sortKey === 'totalAmount'} direction={sortDir} onClick={() => toggleSort('totalAmount')} align="right" />
                      </div>
                    </th>
                    <th className="py-3 px-4">
                      <SortableHeader label="상태" active={sortKey === 'status'} direction={sortDir} onClick={() => toggleSort('status')} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredPos.map((po) => {
                      const totalAmt = po.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
                      const isSel = activePo?.id === po.id;
                      return (
                        <tr
                          key={po.id}
                          onClick={() => setSelectedPoId(po.id)}
                          className={`cursor-pointer transition-colors duration-150 ease-out ${
                            isSel ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-mono font-medium text-slate-900">{po.poNumber}</div>
                            <div className="text-xs font-mono text-slate-500 mt-1">원본 {po.sourcePrNumber}</div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">{po.supplierName}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {totalAmt.toLocaleString()}원
                          </td>
                          <td className="py-3 px-4">
                            <PoStatusLabel status={po.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PO Detail & Print */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-PO-002">
              {!activePo ? (
                <div className="py-16 text-center text-xs text-slate-500">발주서를 선택하세요</div>
              ) : (
                <div>
                  <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-900">{activePo.poNumber}</span>
                        <span>·</span>
                        <span className="font-mono">참조 {activePo.sourcePrNumber}</span>
                        <span>·</span>
                        <span>생성: {activePo.createdAt}</span>
                      </div>
                      <h2 className="mt-1 text-sm font-medium text-slate-900">{activePo.supplierName}</h2>
                      <div className="mt-1 text-xs text-slate-500">
                        연락처: {activePo.supplierPhone}
                        {activePo.supplierEmail ? ` · ${activePo.supplierEmail}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <PoStatusLabel status={activePo.status} />
                      <div className="flex items-center gap-2">
                        {activePo.status !== 'RECEIVED' && hasScreenPermission('gr') && (
                          <button
                            type="button"
                            onClick={() => navigateToGrWithPo(activePo.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
                          >
                            <PackagePlus className="w-4 h-4" strokeWidth={1.5} />
                            입고 진행
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPrintPo(activePo)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
                        >
                          <Printer className="w-4 h-4" strokeWidth={1.5} />
                          발주서 인쇄
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-2 px-3">품목</th>
                            <th className="py-2 px-3 text-right">원발주</th>
                            <th className="py-2 px-3 text-right">누적입고</th>
                            <th className="py-2 px-3 text-right">미입고 잔량</th>
                            <th className="py-2 px-3 text-right">예상금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activePo.items.map((item) => {
                            const remaining = Math.round((item.orderedQty - item.receivedQty) * 1000) / 1000;
                            return (
                              <tr key={item.id}>
                                <td className="py-2 px-3">
                                  <div className="font-medium text-slate-900">{item.materialName}</div>
                                  <div className="text-xs font-mono text-slate-500">{item.materialCode}</div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                  {item.orderedQty.toLocaleString()} {item.unit}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                                  {item.receivedQty.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-blue-700 whitespace-nowrap">
                                  {remaining.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                  {(item.orderedQty * item.unitPrice).toLocaleString()}원
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {siblingPos.length > 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-600 font-medium">
                          {activePo.sourcePrNumber} 분할 발주 목록:
                        </span>
                        {siblingPos.map((sib) => (
                          <button
                            key={sib.id}
                            type="button"
                            onClick={() => setSelectedPoId(sib.id)}
                            className="px-2 py-1 font-mono text-xs bg-white border border-slate-300 hover:border-blue-600 text-blue-700 rounded transition-colors duration-150 ease-out"
                          >
                            {sib.poNumber} ({sib.supplierName})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">
                        담당 구매자: {activePo.purchaserName} {activePo.note ? `· ${activePo.note}` : ''}
                      </span>
                      <span className="font-medium text-slate-900 font-mono tabular-nums">
                        총 예상 발주액:{' '}
                        {activePo.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScreenStateGate>

      {/* Create Split PO Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="승인 요청 기반 내부 분할 발주 생성"
        subtitle="동일 요청의 미발주 잔량 범위 내에서 공급업체별로 여러 발주서를 나누어 생성할 수 있습니다"
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              취소
            </button>
            <button
              type="submit"
              form="create-po-form"
              disabled={!approvedPrsWithRemaining.length}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg transition-colors duration-150 ease-out"
            >
              내부 발주 생성
            </button>
          </>
        }
      >
        <form id="create-po-form" onSubmit={handleCreatePo} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-xs text-red-700">
              <span>{formError}</span>
              {conflictError && (
                <button
                  type="button"
                  onClick={handleRecoverPoConflict}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-md whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                  최신 잔량·새 요청 키로 초기화
                </button>
              )}
            </div>
          )}

          {approvedPrsWithRemaining.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              발주 가능한 승인 구매요청(미발주 잔량 보유)이 없습니다. 승인함에서 요청을 먼저 승인해 주세요.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="승인 완료 구매요청 (미발주 잔량 보유)" required>
                  <SelectInput value={selectedModalPr?.id ?? ''} onChange={(e) => handleSelectPrChange(e.target.value)}>
                    {approvedPrsWithRemaining.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        [{pr.prNumber}] {pr.title} ({pr.items.length}개 품목)
                      </option>
                    ))}
                  </SelectInput>
                </FormField>

                <FormField label="발주 요청 키" required hint="동일 키 재전송 시 중복 생성을 방지합니다">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={poRequestId}
                      onChange={(e) => setPoRequestId(e.target.value)}
                      className="font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setPoRequestId(generateRequestKey('PO'))}
                      className="px-2 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                    >
                      새 키 발급
                    </button>
                    {lastPoSubmit && (
                      <button
                        type="button"
                        onClick={() => setPoRequestId(lastPoSubmit.requestId)}
                        className="px-2 py-2 text-xs text-slate-600 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                      >
                        직전 키
                      </button>
                    )}
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="공급업체 선택 (발주서당 1곳)" required>
                  <SelectInput value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.code}] {s.name} ({s.phone})
                      </option>
                    ))}
                  </SelectInput>
                </FormField>

                <FormField label="발주 비고">
                  <TextInput
                    value={poNote}
                    onChange={(e) => setPoNote(e.target.value)}
                    placeholder="예: 1차 분할 발주, 안산 1공장 납품"
                  />
                </FormField>
              </div>

              {selectedModalPr && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-800">품목별 분할 발주 수량 배분</span>
                    <span className="text-xs text-slate-500">미발주 잔량 이내에서만 입력 가능 (0 입력 시 제외)</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                          <th className="py-2 px-3">품목</th>
                          <th className="py-2 px-3 text-right">승인수량</th>
                          <th className="py-2 px-3 text-right">기발주</th>
                          <th className="py-2 px-3 text-right">미발주 잔량</th>
                          <th className="py-2 px-3 text-right w-28">이번 발주</th>
                          <th className="py-2 px-3 text-right w-32">발주단가(원)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedModalPr.items.map((item) => {
                          const stats = getPrItemOrderStats(selectedModalPr.id, item.id);
                          const qtyVal = allocQtyMap[item.id] ?? 0;
                          const priceVal = unitPriceMap[item.id] ?? item.estimatedUnitPrice;
                          const isOver = qtyVal > stats.remainingToOrder;
                          return (
                            <tr key={item.id}>
                              <td className="py-2 px-3">
                                <div className="font-medium text-slate-900">{item.materialName}</div>
                                <div className="text-xs font-mono text-slate-500">
                                  {item.materialCode} · {item.unit}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                {stats.requestedQty.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                                {stats.orderedQty.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-blue-700">
                                {stats.remainingToOrder.toLocaleString()} {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={item.unit === 'EA' || item.unit === 'SET' ? 1 : '0.001'}
                                  disabled={stats.remainingToOrder <= 0}
                                  value={qtyVal}
                                  onChange={(e) =>
                                    setAllocQtyMap((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                                  }
                                  className={`w-24 px-2 py-1 text-right font-mono tabular-nums text-xs border rounded-lg ${
                                    isOver
                                      ? 'border-red-400 bg-red-50 text-red-700'
                                      : 'border-slate-300 bg-white text-slate-900 disabled:bg-slate-100'
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  disabled={stats.remainingToOrder <= 0}
                                  value={priceVal}
                                  onChange={(e) =>
                                    setUnitPriceMap((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                                  }
                                  className="w-28 px-2 py-1 text-right font-mono tabular-nums text-xs border border-slate-300 bg-white text-slate-900 rounded-lg disabled:bg-slate-100"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-right text-xs font-mono tabular-nums text-slate-700">
                    이번 발주 예상 금액:{' '}
                    <span className="font-semibold text-slate-900">{modalOrderTotal.toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      {/* Print Preview Modal */}
      <Modal
        open={Boolean(printPo)}
        onClose={() => setPrintPo(null)}
        title="내부 구매발주서 인쇄 미리보기"
        subtitle="브라우저 인쇄 기능을 통해 출력할 수 있습니다"
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPrintPo(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
              인쇄하기
            </button>
          </>
        }
      >
        {printPo && (
          <div id="po-print-area" className="p-6 border border-slate-300 bg-white text-slate-900 space-y-6 rounded-lg">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h3 className="text-xl font-semibold">내부 구매발주서</h3>
                <p className="text-xs text-slate-600 mt-1">차곡제조 내부 관리용 발주 문서</p>
              </div>
              <div className="text-right text-xs font-mono">
                <div className="font-semibold text-sm">{printPo.poNumber}</div>
                <div className="text-slate-600">근거 요청: {printPo.sourcePrNumber}</div>
                <div className="text-slate-600">작성일: {printPo.createdAt}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="font-medium text-slate-700 mb-1">공급업체 정보</div>
                <div className="font-semibold text-slate-900">{printPo.supplierName}</div>
                <div className="mt-1 text-slate-600">전화: {printPo.supplierPhone}</div>
                <div className="text-slate-600">이메일: {printPo.supplierEmail || '-'}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="font-medium text-slate-700 mb-1">발주 담당 정보</div>
                <div className="font-semibold text-slate-900">차곡제조 자재구매팀</div>
                <div className="mt-1 text-slate-600">담당자: {printPo.purchaserName}</div>
                <div className="text-slate-600">비고: {printPo.note || '-'}</div>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2 px-3 border-r border-slate-300">품목코드</th>
                  <th className="py-2 px-3 border-r border-slate-300">품목명 / 규격</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">발주수량</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-right">예상단가</th>
                  <th className="py-2 px-3 text-right">예상금액</th>
                </tr>
              </thead>
              <tbody>
                {printPo.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="py-2 px-3 border-r border-slate-300 font-mono">{item.materialCode}</td>
                    <td className="py-2 px-3 border-r border-slate-300">
                      <div className="font-medium">{item.materialName}</div>
                      <div className="text-xs text-slate-500">{item.spec}</div>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                      {item.orderedQty.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono tabular-nums">
                      {item.unitPrice.toLocaleString()}원
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">
                      {(item.orderedQty * item.unitPrice).toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right text-sm font-semibold font-mono tabular-nums">
              합계 예상 발주액: {printPo.items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0).toLocaleString()}원
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
