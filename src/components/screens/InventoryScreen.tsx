import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { PageHeader } from '../common/AppShell';
import { SearchToolbar, SortableHeader, SortDirection } from '../common/FormControls';
import { ScreenStateGate } from '../common/StateOverlay';

type BalanceSortKey = 'materialCode' | 'warehouseName' | 'qtyOnHand' | 'updatedAt';
type LedgerSortKey = 'movementNo' | 'type' | 'qtyDelta' | 'occurredAt';

// Screen Owner: B | Spec ID: ST-01
export const InventoryScreen: React.FC = () => {
  const { stockBalances, stockMovements, materials, warehouses, storageLocations, getTotalStockForMaterial } = useErp();

  const [tab, setTab] = useState<'BALANCE' | 'LEDGER'>('BALANCE');
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [balSortKey, setBalSortKey] = useState<BalanceSortKey>('materialCode');
  const [balSortDir, setBalSortDir] = useState<SortDirection>('asc');
  const [ledSortKey, setLedSortKey] = useState<LedgerSortKey>('movementNo');
  const [ledSortDir, setLedSortDir] = useState<SortDirection>('desc');

  const toggleBalSort = (key: BalanceSortKey) => {
    if (balSortKey === key) {
      setBalSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setBalSortKey(key);
      setBalSortDir(key === 'updatedAt' ? 'desc' : 'asc');
    }
  };

  const toggleLedSort = (key: LedgerSortKey) => {
    if (ledSortKey === key) {
      setLedSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLedSortKey(key);
      setLedSortDir(key === 'movementNo' || key === 'occurredAt' ? 'desc' : 'asc');
    }
  };

  const enrichedBalances = useMemo(() => {
    const base = stockBalances
      .map((sb) => {
        const mat = materials.find((m) => m.id === sb.materialId);
        const wh = warehouses.find((w) => w.id === sb.warehouseId);
        const loc = storageLocations.find((l) => l.id === sb.storageLocationId);
        const totalForMat = mat ? getTotalStockForMaterial(mat.id) : sb.qtyOnHand;
        const isLow = Boolean(mat && mat.safetyStock > 0 && totalForMat < mat.safetyStock);
        return {
          ...sb,
          materialCode: mat?.code ?? '-',
          materialName: mat?.name ?? '-',
          spec: mat?.spec ?? '-',
          unit: mat?.unit ?? 'EA',
          unitPrice: mat?.unitPrice ?? 0,
          safetyStock: mat?.safetyStock ?? 0,
          warehouseName: wh?.name ?? '-',
          locationCode: loc?.code ?? '-',
          locationName: loc?.name ?? '-',
          isLow,
        };
      })
      .filter((row) => {
        if (onlyLowStock && !row.isLow) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          row.materialCode.toLowerCase().includes(q) ||
          row.materialName.toLowerCase().includes(q) ||
          row.warehouseName.toLowerCase().includes(q) ||
          row.locationCode.toLowerCase().includes(q)
        );
      });
    const dir = balSortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (balSortKey) {
        case 'materialCode':
          return a.materialCode.localeCompare(b.materialCode) * dir;
        case 'warehouseName':
          return a.warehouseName.localeCompare(b.warehouseName) * dir;
        case 'qtyOnHand':
          return (a.qtyOnHand - b.qtyOnHand) * dir;
        case 'updatedAt':
          return a.updatedAt.localeCompare(b.updatedAt) * dir;
      }
    });
  }, [stockBalances, materials, warehouses, storageLocations, getTotalStockForMaterial, onlyLowStock, search, balSortKey, balSortDir]);

  const filteredMovements = useMemo(() => {
    const base = !search.trim()
      ? stockMovements
      : stockMovements.filter((m) => {
          const q = search.toLowerCase();
          return (
            m.movementNo.toLowerCase().includes(q) ||
            m.materialCode.toLowerCase().includes(q) ||
            m.materialName.toLowerCase().includes(q) ||
            m.refDocNo.toLowerCase().includes(q)
          );
        });
    const dir = ledSortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (ledSortKey) {
        case 'movementNo':
          return a.movementNo.localeCompare(b.movementNo) * dir;
        case 'type':
          return a.type.localeCompare(b.type) * dir;
        case 'qtyDelta':
          return (a.qtyDelta - b.qtyDelta) * dir;
        case 'occurredAt':
          return a.occurredAt.localeCompare(b.occurredAt) * dir;
      }
    });
  }, [stockMovements, search, ledSortKey, ledSortDir]);

  return (
    <div data-screen-id={tab === 'BALANCE' ? 'SCR-STK-001' : 'SCR-STK-002'} data-spec-id="ST-01" data-owner="B">
      <PageHeader
        title="재고·수불 원장"
        subtitle="창고 및 저장위치별 현재고와 불변 수불 원장 이력 조회"
      />

      <ScreenStateGate
        screenId="inventory"
        emptyTitle="표시할 재고 또는 원장 내역이 없습니다"
        emptyDescription="입고가 확정되면 현재고와 수불 원장이 자동으로 기록됩니다."
      >
        <div className="space-y-4">
          <SearchToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="품목코드, 품목명, 창고, 참조문서번호 검색"
            leftSlot={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTab('BALANCE')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                      tab === 'BALANCE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    현재고 ({enrichedBalances.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('LEDGER')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                      tab === 'LEDGER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    재고 원장 ({filteredMovements.length})
                  </button>
                </div>

                {tab === 'BALANCE' && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyLowStock}
                      onChange={(e) => setOnlyLowStock(e.target.checked)}
                      className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    안전재고 미달만 보기
                  </label>
                )}
              </div>
            }
            rightSlot={
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                총 재고 평가액:{' '}
                {enrichedBalances.reduce((s, b) => s + b.qtyOnHand * b.unitPrice, 0).toLocaleString()}원
              </span>
            }
          />

          {tab === 'BALANCE' ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" data-screen-id="SCR-STK-001">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">
                        <SortableHeader label="품목코드" active={balSortKey === 'materialCode'} direction={balSortDir} onClick={() => toggleBalSort('materialCode')} />
                      </th>
                      <th className="py-3 px-4">품목명 / 규격</th>
                      <th className="py-3 px-4">
                        <SortableHeader label="창고" active={balSortKey === 'warehouseName'} direction={balSortDir} onClick={() => toggleBalSort('warehouseName')} />
                      </th>
                      <th className="py-3 px-4">저장위치</th>
                      <th className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <SortableHeader label="현재고" active={balSortKey === 'qtyOnHand'} direction={balSortDir} onClick={() => toggleBalSort('qtyOnHand')} align="right" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">안전재고</th>
                      <th className="py-3 px-4">재고상태</th>
                      <th className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <SortableHeader label="최종갱신" active={balSortKey === 'updatedAt'} direction={balSortDir} onClick={() => toggleBalSort('updatedAt')} align="right" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {enrichedBalances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          조건에 해당하는 재고가 없습니다
                        </td>
                      </tr>
                    ) : (
                      enrichedBalances.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">{b.materialCode}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{b.materialName}</div>
                            <div className="text-xs text-slate-500">{b.spec}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{b.warehouseName}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-slate-800">{b.locationCode}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="text-slate-500">{b.locationName}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                            {b.qtyOnHand.toLocaleString()} {b.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                            {b.safetyStock.toLocaleString()} {b.unit}
                          </td>
                          <td className="py-3 px-4">
                            {b.isLow ? (
                              <span className="inline-flex items-center gap-2 text-xs font-medium text-red-700">
                                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                                부족
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                                적정
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                            {b.updatedAt}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" data-screen-id="SCR-STK-002">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-3 px-4">
                        <SortableHeader label="원장번호" active={ledSortKey === 'movementNo'} direction={ledSortDir} onClick={() => toggleLedSort('movementNo')} />
                      </th>
                      <th className="py-3 px-4">
                        <SortableHeader label="유형" active={ledSortKey === 'type'} direction={ledSortDir} onClick={() => toggleLedSort('type')} />
                      </th>
                      <th className="py-3 px-4">참조문서</th>
                      <th className="py-3 px-4">품목</th>
                      <th className="py-3 px-4">창고 / 저장위치</th>
                      <th className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <SortableHeader label="변동수량" active={ledSortKey === 'qtyDelta'} direction={ledSortDir} onClick={() => toggleLedSort('qtyDelta')} align="right" />
                        </div>
                      </th>
                      <th className="py-3 px-4">처리자</th>
                      <th className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <SortableHeader label="발생시각" active={ledSortKey === 'occurredAt'} direction={ledSortDir} onClick={() => toggleLedSort('occurredAt')} align="right" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          조건에 해당하는 재고 원장 이력이 없습니다
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-800">{m.movementNo}</td>
                          <td className="py-3 px-4 text-slate-700">
                            {m.type === 'GR_IN' ? '입고 (+)' : '개시재고'}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-blue-700">{m.refDocNo}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-slate-500 mr-2">{m.materialCode}</span>
                            <span className="font-medium text-slate-900">{m.materialName}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {m.warehouseName} · <span className="font-mono">{m.storageLocationCode}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-emerald-700">
                            +{m.qtyDelta.toLocaleString()} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{m.actorName}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                            {m.occurredAt}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ScreenStateGate>
    </div>
  );
};
