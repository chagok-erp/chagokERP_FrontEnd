import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { Material } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { FormField, SearchToolbar, SelectInput, SortableHeader, SortDirection, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { ActiveStatusLabel } from '../common/StatusLabel';

type MaterialSortKey = 'code' | 'name' | 'unitPrice' | 'stock' | 'active';

// Screen Owner: A | Spec ID: MAT-01
export const MaterialsScreen: React.FC = () => {
  const {
    materials,
    hasAnyRole,
    getTotalStockForMaterial,
    createMaterial,
    updateMaterial,
    toggleMaterialActive,
    pushToast,
  } = useErp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortKey, setSortKey] = useState<MaterialSortKey>('code');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [unit, setUnit] = useState<Material['unit']>('EA');
  const [unitPrice, setUnitPrice] = useState('10000');
  const [safetyStock, setSafetyStock] = useState('10');
  const [category, setCategory] = useState('구동부품');
  const [formError, setFormError] = useState<string | null>(null);

  const canEdit = hasAnyRole(['PURCHASER', 'ADMIN']);

  const toggleSort = (key: MaterialSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const base = materials.filter((m) => {
      if (statusFilter === 'ACTIVE' && !m.active) return false;
      if (statusFilter === 'INACTIVE' && m.active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.spec.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case 'code':
          return a.code.localeCompare(b.code) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'unitPrice':
          return (a.unitPrice - b.unitPrice) * dir;
        case 'stock':
          return (getTotalStockForMaterial(a.id) - getTotalStockForMaterial(b.id)) * dir;
        case 'active':
          return (Number(a.active) - Number(b.active)) * dir;
      }
    });
  }, [materials, search, statusFilter, sortKey, sortDir, getTotalStockForMaterial]);

  const openCreateModal = () => {
    setEditingMat(null);
    setCode('');
    setName('');
    setSpec('');
    setUnit('EA');
    setUnitPrice('10000');
    setSafetyStock('10');
    setCategory('구동부품');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (m: Material) => {
    setEditingMat(m);
    setCode(m.code);
    setName(m.name);
    setSpec(m.spec);
    setUnit(m.unit);
    setUnitPrice(String(m.unitPrice));
    setSafetyStock(String(m.safetyStock));
    setCategory(m.category);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const res = editingMat
      ? updateMaterial(editingMat.id, {
          name,
          spec,
          category,
          unitPrice: Number(unitPrice) || 0,
          safetyStock: Number(safetyStock) || 0,
        })
      : createMaterial({
          code,
          name,
          spec,
          unit,
          unitPrice: Number(unitPrice) || 0,
          safetyStock: Number(safetyStock) || 0,
          category,
          active: true,
        });
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    pushToast('success', editingMat ? '품목 수정 완료' : '품목 등록 완료', res.message);
    setFormError(null);
    setModalOpen(false);
  };

  return (
    <div data-screen-id="SCR-MAT-001" data-spec-id="MAT-01" data-owner="A">
      <PageHeader
        title="품목 마스터"
        subtitle="구매요청·발주 및 문서 품목 매칭에서 공통 참조하는 자재 기준정보"
        actions={
          <button
            type="button"
            disabled={!canEdit}
            onClick={openCreateModal}
            title={!canEdit ? '구매 담당자 또는 관리자만 품목을 등록할 수 있습니다' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            품목 등록
          </button>
        }
      />

      <ScreenStateGate
        screenId="materials"
        emptyTitle="조건에 맞는 품목이 없습니다"
        emptyDescription="검색 조건을 초기화하거나 새로운 품목을 등록해 주세요."
        emptyActionLabel="전체 품목 보기"
      >
        <div className="space-y-4">
          <SearchToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="품목코드, 품목명, 규격, 분류 검색"
            leftSlot={
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                      statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? '전체' : st === 'ACTIVE' ? '사용중' : '비활성'}
                  </button>
                ))}
              </div>
            }
            rightSlot={
              <span className="text-xs text-slate-500 tabular-nums">총 {filtered.length}개 품목</span>
            }
          />

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">
                      <SortableHeader label="품목코드" active={sortKey === 'code'} direction={sortDir} onClick={() => toggleSort('code')} />
                    </th>
                    <th className="py-3 px-4">
                      <SortableHeader label="품목명" active={sortKey === 'name'} direction={sortDir} onClick={() => toggleSort('name')} />
                    </th>
                    <th className="py-3 px-4">규격</th>
                    <th className="py-3 px-4">분류</th>
                    <th className="py-3 px-4">기준단위</th>
                    <th className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <SortableHeader label="기준단가" active={sortKey === 'unitPrice'} direction={sortDir} onClick={() => toggleSort('unitPrice')} align="right" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <SortableHeader label="현재고 / 안전재고" active={sortKey === 'stock'} direction={sortDir} onClick={() => toggleSort('stock')} align="right" />
                      </div>
                    </th>
                    <th className="py-3 px-4">
                      <SortableHeader label="상태" active={sortKey === 'active'} direction={sortDir} onClick={() => toggleSort('active')} />
                    </th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m) => {
                      const stock = getTotalStockForMaterial(m.id);
                      const isLow = m.active && m.safetyStock > 0 && stock < m.safetyStock;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                            {m.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">{m.name}</td>
                          <td className="py-3 px-4 text-slate-600">{m.spec}</td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{m.category}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{m.unit}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                            {m.unitPrice.toLocaleString()}원
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className={isLow ? 'text-red-700 font-medium' : 'text-slate-800'}>
                              {stock.toLocaleString()}
                            </span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-500">{m.safetyStock.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4">
                            <ActiveStatusLabel active={m.active} />
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => openEditModal(m)}
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                  const res = toggleMaterialActive(m.id);
                                  pushToast(res.ok ? 'info' : 'error', res.ok ? '상태 변경' : '권한 오류', res.message);
                                }}
                                className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {m.active ? '비활성화' : '활성화'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ScreenStateGate>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMat ? `품목 정보 수정 (${editingMat.code})` : '신규 품목 등록'}
        subtitle="품목 코드·기준단위는 변경할 수 없으며 비활성 품목은 구매요청에서 선택이 제한됩니다"
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
              form="create-material-form"
              className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out"
            >
              {editingMat ? '수정 저장' : '등록 저장'}
            </button>
          </>
        }
      >
        <form id="create-material-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="품목 코드" required hint={editingMat ? '코드는 수정할 수 없습니다' : '예: MAT-1012'}>
              <TextInput
                value={code}
                disabled={Boolean(editingMat)}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MAT-1012"
              />
            </FormField>
            <FormField label="품목 분류" required>
              <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="구동부품" />
            </FormField>
          </div>
          <FormField label="품목명" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="정밀 볼스크류 SFU1605" />
          </FormField>
          <FormField label="규격" required>
            <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="외경 16mm / 리드 5mm / L800" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="기준단위" required hint={editingMat ? '단위 변경 불가' : undefined}>
              <SelectInput
                value={unit}
                disabled={Boolean(editingMat)}
                onChange={(e) => setUnit(e.target.value as Material['unit'])}
              >
                <option value="EA">EA</option>
                <option value="SET">SET</option>
                <option value="M">M</option>
                <option value="KG">KG</option>
                <option value="L">L</option>
              </SelectInput>
            </FormField>
            <FormField label="기준단가 (원)" required>
              <TextInput type="number" min={0} step={1} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </FormField>
            <FormField label="안전재고 수량" required>
              <TextInput
                type="number"
                min={0}
                step={unit === 'EA' || unit === 'SET' ? 1 : '0.001'}
                value={safetyStock}
                onChange={(e) => setSafetyStock(e.target.value)}
              />
            </FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
};
