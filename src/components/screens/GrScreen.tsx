import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, PackagePlus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { generateRequestKey } from '../../services/erpApi';
import { PageHeader } from '../common/AppShell';
import { FormField, SelectInput, TextInput } from '../common/FormControls';
import { ScreenStateGate } from '../common/StateOverlay';
import { PoStatusLabel } from '../common/StatusLabel';

// Screen Owner: B (with A's PO validation contract) | Spec ID: GR-01, GR-02
export const GrScreen: React.FC = () => {
  const {
    pos,
    grs,
    warehouses,
    storageLocations,
    preselectedGrPoId,
    setPreselectedGrPoId,
    hasAnyRole,
    postGoodsReceipt,
    pushToast,
  } = useErp();

  const receivablePos = useMemo(() => pos.filter((p) => p.status !== 'RECEIVED'), [pos]);
  const [selectedPoId, setSelectedPoId] = useState<string>(receivablePos[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState<string>(
    warehouses.find((w) => w.active)?.id ?? warehouses[0]?.id ?? ''
  );
  const [bulkLocationId, setBulkLocationId] = useState<string>(
    storageLocations.find((l) => l.warehouseId === (warehouses.find((w) => w.active)?.id ?? warehouses[0]?.id) && l.active)?.id ?? ''
  );
  const [locMap, setLocMap] = useState<Record<string, string>>({});
  const [requestId, setRequestId] = useState<string>(() => generateRequestKey('GR'));
  const [note, setNote] = useState('');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);
  const [lastSubmittedKey, setLastSubmittedKey] = useState<string | null>(null);
  const [grSearch, setGrSearch] = useState('');
  const [selectedGrId, setSelectedGrId] = useState<string>(grs[0]?.id ?? '');

  const canPostGr = hasAnyRole(['WAREHOUSE', 'ADMIN']);
  const selectedPo = useMemo(
    () => pos.find((p) => p.id === selectedPoId) || receivablePos[0] || null,
    [pos, selectedPoId, receivablePos]
  );

  const locationsForWarehouse = useMemo(
    () => storageLocations.filter((l) => l.warehouseId === warehouseId),
    [storageLocations, warehouseId]
  );

  const filteredGrs = useMemo(() => {
    if (!grSearch.trim()) return grs;
    const q = grSearch.toLowerCase();
    return grs.filter(
      (g) =>
        g.grNumber.toLowerCase().includes(q) ||
        g.poNumber.toLowerCase().includes(q) ||
        g.requestId.toLowerCase().includes(q) ||
        g.items.some((i) => i.materialName.toLowerCase().includes(q) || i.materialCode.toLowerCase().includes(q))
    );
  }, [grs, grSearch]);

  const activeGr = useMemo(
    () => grs.find((g) => g.id === selectedGrId) || filteredGrs[0] || null,
    [grs, selectedGrId, filteredGrs]
  );

  // Honor preselected PO passed from PoScreen ("입고 진행")
  useEffect(() => {
    if (!preselectedGrPoId) return;
    setSelectedPoId(preselectedGrPoId);
    setPreselectedGrPoId(null);
  }, [preselectedGrPoId, setPreselectedGrPoId]);

  const resetPoLines = (targetPo = selectedPo, targetWhId = warehouseId) => {
    if (!targetPo) return;
    const firstActiveLoc =
      storageLocations.find((l) => l.warehouseId === targetWhId && l.active)?.id ??
      storageLocations.find((l) => l.warehouseId === targetWhId)?.id ??
      '';
    const nextQty: Record<string, number> = {};
    const nextLoc: Record<string, string> = {};
    for (const item of targetPo.items) {
      nextQty[item.id] = Math.max(0, Math.round((item.orderedQty - item.receivedQty) * 1000) / 1000);
      nextLoc[item.id] = firstActiveLoc;
    }
    setQtyMap(nextQty);
    setLocMap(nextLoc);
    setBulkLocationId(firstActiveLoc);
    setFormError(null);
    setConflictError(false);
  };

  useEffect(() => {
    if (!selectedPo) return;
    resetPoLines(selectedPo, warehouseId);
  }, [selectedPo?.id]);

  const handleWarehouseChange = (nextWhId: string) => {
    setWarehouseId(nextWhId);
    const firstActive = storageLocations.find((l) => l.warehouseId === nextWhId && l.active)?.id ?? '';
    setBulkLocationId(firstActive);
    if (selectedPo) {
      const nextLoc: Record<string, string> = {};
      for (const item of selectedPo.items) {
        nextLoc[item.id] = firstActive;
      }
      setLocMap(nextLoc);
    }
  };

  const applyBulkLocation = () => {
    if (!selectedPo || !bulkLocationId) return;
    const nextLoc: Record<string, string> = {};
    for (const item of selectedPo.items) {
      nextLoc[item.id] = bulkLocationId;
    }
    setLocMap(nextLoc);
  };

  const handleResetConflict = () => {
    resetPoLines(selectedPo, warehouseId);
    setRequestId(generateRequestKey('GR'));
  };

  const executePost = (customRequestId: string) => {
    if (!selectedPo) return;
    const lines = selectedPo.items.map((item) => ({
      poItemId: item.id,
      qty: Number(qtyMap[item.id] ?? 0),
      storageLocationId: locMap[item.id] ?? bulkLocationId,
    }));

    const res = postGoodsReceipt({
      requestId: customRequestId,
      poId: selectedPo.id,
      warehouseId,
      note,
      lines,
    });

    if (!res.ok) {
      setFormError(res.message);
      setConflictError(res.errorCode === 'CONFLICT');
      pushToast('error', '입고 처리 차단', res.message);
      return;
    }

    setFormError(null);
    setConflictError(false);
    if (res.idempotentReplay) {
      pushToast('info', '동일 요청 재시도 (기존 결과 반환)', res.message);
      return;
    }

    if (res.data) setSelectedGrId(res.data.id);
    setLastSubmittedKey(customRequestId);
    pushToast('success', '입고 확정 완료', res.message);
    setRequestId(generateRequestKey('GR'));
    setNote('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executePost(requestId);
  };

  return (
    <div data-screen-id="SCR-GR-001" data-spec-id="GR-01 / GR-02" data-owner="B">
      <PageHeader
        title="입고 등록"
        subtitle="발주서 기준 수동·부분 입고 등록 및 잔량·품목별 저장위치·중복 요청 검증"
      />

      <ScreenStateGate
        screenId="gr"
        emptyTitle="입고 처리할 발주 또는 입고 이력이 없습니다"
        emptyDescription="구매발주가 생성되면 이곳에서 부분 입고 및 완납 처리를 진행할 수 있습니다."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: GR Posting Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-GR-001">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-slate-900">부분 입고 등록</h2>
                <p className="mt-1 text-xs text-slate-500">
                  발주 누적입고, 입고 문서, 재고 원장 및 품목별 저장위치 현재고가 함께 반영됩니다
                </p>
              </div>
              {selectedPo && <PoStatusLabel status={selectedPo.status} />}
            </div>

            {receivablePos.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                현재 입고 대기 또는 부분 입고 상태의 발주서가 없습니다
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-xs text-red-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                      <span>{formError}</span>
                    </div>
                    {conflictError && (
                      <button
                        type="button"
                        onClick={handleResetConflict}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-md whitespace-nowrap shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                        최신 잔량·새 키로 초기화
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="대상 구매발주" required>
                    <SelectInput value={selectedPo?.id ?? ''} onChange={(e) => setSelectedPoId(e.target.value)}>
                      {receivablePos.map((po) => (
                        <option key={po.id} value={po.id}>
                          [{po.poNumber}] {po.supplierName}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField label="입고 요청 키" required hint="동일 키 재전송 시 중복 입고를 차단합니다">
                    <div className="flex items-center gap-2">
                      <TextInput
                        value={requestId}
                        onChange={(e) => setRequestId(e.target.value)}
                        className="font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setRequestId(generateRequestKey('GR'))}
                        className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                      >
                        새 키 발급
                      </button>
                    </div>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="입고 창고" required>
                    <SelectInput value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          [{w.code}] {w.name} {!w.active ? '(비활성 — 입고 불가)' : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField label="기본 저장위치 일괄 적용" hint="품목 행별로 저장위치를 다르게 지정할 수 있습니다">
                    <div className="flex items-center gap-2">
                      <SelectInput value={bulkLocationId} onChange={(e) => setBulkLocationId(e.target.value)}>
                        {locationsForWarehouse.map((l) => (
                          <option key={l.id} value={l.id}>
                            [{l.code}] {l.name} {!l.active ? '(비활성)' : ''}
                          </option>
                        ))}
                      </SelectInput>
                      <button
                        type="button"
                        onClick={applyBulkLocation}
                        disabled={!bulkLocationId}
                        className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0"
                      >
                        일괄 적용
                      </button>
                    </div>
                  </FormField>
                </div>

                {selectedPo && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-800">발주 품목별 입고 수량 및 저장위치</span>
                      <span className="text-xs text-slate-500">잔여 수량 초과 및 비활성 위치 입력 불가</span>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-2 px-3">품목</th>
                            <th className="py-2 px-3 text-right">원발주</th>
                            <th className="py-2 px-3 text-right">누적입고</th>
                            <th className="py-2 px-3 text-right">미입고 잔량</th>
                            <th className="py-2 px-3 min-w-[140px]">저장위치</th>
                            <th className="py-2 px-3 text-right w-28">이번 입고</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPo.items.map((item) => {
                            const remaining = Math.round((item.orderedQty - item.receivedQty) * 1000) / 1000;
                            const val = qtyMap[item.id] ?? 0;
                            const isOver = val > remaining;
                            const rowLocId = locMap[item.id] ?? bulkLocationId;
                            const rowLoc = locationsForWarehouse.find((l) => l.id === rowLocId);
                            const isLocInvalid = val > 0 && (!rowLoc || !rowLoc.active);
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
                                <td className="py-2 px-3">
                                  <select
                                    value={rowLocId}
                                    disabled={remaining <= 0}
                                    onChange={(e) =>
                                      setLocMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    className={`w-full px-2 py-1 text-xs border rounded-lg bg-white disabled:bg-slate-100 ${
                                      isLocInvalid
                                        ? 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-slate-300 text-slate-900'
                                    }`}
                                  >
                                    {locationsForWarehouse.length === 0 ? (
                                      <option value="">저장위치 없음</option>
                                    ) : (
                                      locationsForWarehouse.map((l) => (
                                        <option key={l.id} value={l.id}>
                                          {l.code} · {l.name} {!l.active ? '(비활성 — 입고 불가)' : ''}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    step={item.unit === 'EA' || item.unit === 'SET' ? 1 : '0.001'}
                                    disabled={remaining <= 0}
                                    value={val}
                                    onChange={(e) =>
                                      setQtyMap((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                                    }
                                    className={`w-24 px-2 py-1 text-right font-mono tabular-nums text-xs border rounded-lg disabled:bg-slate-100 ${
                                      isOver
                                        ? 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-slate-300 bg-white text-slate-900'
                                    }`}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <FormField label="입고 비고">
                  <TextInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="예: 2차 잔여분 입고 완료 / 외관 이상 없음"
                  />
                </FormField>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  {lastSubmittedKey ? (
                    <button
                      type="button"
                      onClick={() => executePost(lastSubmittedKey)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg transition-colors duration-150 ease-out"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-700" strokeWidth={1.5} />
                      직전 키({lastSubmittedKey}) 중복 재전송 확인
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="submit"
                    disabled={!canPostGr || !selectedPo}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg transition-colors duration-150 ease-out"
                  >
                    <PackagePlus className="w-4 h-4" strokeWidth={1.5} />
                    입고 확정
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Posted GR History & Detail (SCR-GR-002) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden self-start" data-screen-id="SCR-GR-002">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-900">입고 문서 이력 및 상세</h2>
              <span className="text-xs text-slate-500 tabular-nums">{filteredGrs.length}건</span>
            </div>

            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
                <input
                  type="text"
                  value={grSearch}
                  onChange={(e) => setGrSearch(e.target.value)}
                  placeholder="입고번호, 발주번호, 품목, 요청키 검색"
                  className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600"
                />
              </div>
            </div>

            {filteredGrs.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-slate-500">조건에 맞는 입고 문서가 없습니다</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                {filteredGrs.map((gr) => {
                  const isSel = activeGr?.id === gr.id;
                  return (
                    <button
                      key={gr.id}
                      type="button"
                      onClick={() => setSelectedGrId(gr.id)}
                      className={`w-full p-4 text-left transition-colors duration-150 ease-out space-y-1 ${
                        isSel ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-medium text-slate-900">{gr.grNumber}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-600">{gr.poNumber}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                          확정됨
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {gr.receiverName} · {gr.postedAt} · {gr.items.length}개 품목
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGr && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">선택 입고 문서 상세 ({activeGr.grNumber})</span>
                  <span className="font-mono text-slate-500">요청키: {activeGr.requestId}</span>
                </div>
                <ul className="space-y-1 bg-white border border-slate-200 rounded-lg p-3 text-xs">
                  {activeGr.items.map((gi) => (
                    <li key={gi.id} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-slate-800 truncate">
                        <span className="font-mono text-slate-500 mr-1">{gi.materialCode}</span>
                        {gi.materialName} ({gi.warehouseName} · {gi.storageLocationCode})
                      </span>
                      <span className="font-mono tabular-nums font-medium text-emerald-700 shrink-0">
                        +{gi.receivedQty.toLocaleString()} {gi.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                {activeGr.note && <div className="text-xs text-slate-600">비고: {activeGr.note}</div>}
              </div>
            )}
          </div>
        </div>
      </ScreenStateGate>
    </div>
  );
};
