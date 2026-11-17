import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { StorageLocation, Warehouse } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { FormField, SelectInput, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { ActiveStatusLabel } from '../common/StatusLabel';

// Screen Owner: B | Spec ID: WH-01
export const WarehousesScreen: React.FC = () => {
  const {
    warehouses,
    storageLocations,
    stockBalances,
    hasAnyRole,
    createWarehouse,
    updateWarehouse,
    createStorageLocation,
    updateStorageLocation,
    pushToast,
  } = useErp();

  const [selectedWhId, setSelectedWhId] = useState<string>(warehouses[0]?.id ?? '');

  // Storage Location Create / Edit Modal
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<StorageLocation | null>(null);
  const [whId, setWhId] = useState(warehouses[0]?.id ?? '');
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locZone, setLocZone] = useState('원자재 존');
  const [locActive, setLocActive] = useState(true);
  const [locFormError, setLocFormError] = useState<string | null>(null);

  // Warehouse Create / Edit Modal
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whPlantName, setWhPlantName] = useState('안산 1공장');
  const [whActive, setWhActive] = useState(true);
  const [whFormError, setWhFormError] = useState<string | null>(null);

  const canEdit = hasAnyRole(['WAREHOUSE', 'ADMIN']);

  const visibleLocations = storageLocations.filter((l) => !selectedWhId || l.warehouseId === selectedWhId);

  const openNewWarehouseModal = () => {
    setEditingWh(null);
    setWhCode('');
    setWhName('');
    setWhPlantName('안산 1공장');
    setWhActive(true);
    setWhFormError(null);
    setWhModalOpen(true);
  };

  const openEditWarehouseModal = (wh: Warehouse) => {
    setEditingWh(wh);
    setWhCode(wh.code);
    setWhName(wh.name);
    setWhPlantName(wh.plantName);
    setWhActive(wh.active);
    setWhFormError(null);
    setWhModalOpen(true);
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    const res = editingWh
      ? updateWarehouse(editingWh.id, {
          name: whName,
          plantName: whPlantName,
          active: whActive,
        })
      : createWarehouse({
          code: whCode,
          name: whName,
          plantName: whPlantName,
          active: whActive,
        });

    if (!res.ok) {
      setWhFormError(res.message);
      return;
    }
    pushToast('success', editingWh ? '창고 수정 완료' : '창고 등록 완료', res.message);
    if (!editingWh && res.data) {
      setSelectedWhId(res.data.id);
    }
    setWhFormError(null);
    setWhModalOpen(false);
  };

  const openNewLocationModal = () => {
    setEditingLoc(null);
    setWhId(selectedWhId || warehouses[0]?.id || '');
    setLocCode('');
    setLocName('');
    setLocZone('원자재 존');
    setLocActive(true);
    setLocFormError(null);
    setLocModalOpen(true);
  };

  const openEditLocationModal = (loc: StorageLocation) => {
    setEditingLoc(loc);
    setWhId(loc.warehouseId);
    setLocCode(loc.code);
    setLocName(loc.name);
    setLocZone(loc.zone);
    setLocActive(loc.active);
    setLocFormError(null);
    setLocModalOpen(true);
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    const res = editingLoc
      ? updateStorageLocation(editingLoc.id, {
          name: locName,
          zone: locZone,
          active: locActive,
        })
      : createStorageLocation({
          warehouseId: whId,
          code: locCode,
          name: locName,
          zone: locZone,
          active: locActive,
        });

    if (!res.ok) {
      setLocFormError(res.message);
      return;
    }
    pushToast('success', editingLoc ? '저장위치 수정 완료' : '저장위치 추가 완료', res.message);
    setLocFormError(null);
    setLocModalOpen(false);
  };

  return (
    <div data-screen-id="SCR-WH-001" data-spec-id="WH-01" data-owner="B">
      <PageHeader
        title="창고·저장위치 관리"
        subtitle="입고 등록 시 선택 가능한 창고 및 소속 저장위치 기준정보"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={openNewWarehouseModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              창고 등록
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={openNewLocationModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              저장위치 추가
            </button>
          </div>
        }
      />

      <ScreenStateGate
        screenId="warehouses"
        emptyTitle="등록된 창고 또는 저장위치가 없습니다"
        emptyDescription="입고 처리를 위해 최소 1개 이상의 창고 및 활성 저장위치가 필요합니다."
        emptyActionLabel="창고 등록"
        onEmptyAction={canEdit ? openNewWarehouseModal : undefined}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Warehouse Selector List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden self-start">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-medium text-slate-800">창고 목록 ({warehouses.length})</h2>
              <button
                type="button"
                onClick={() => setSelectedWhId('')}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                전체 보기
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {warehouses.map((wh) => {
                const locCount = storageLocations.filter((l) => l.warehouseId === wh.id).length;
                const isSelected = selectedWhId === wh.id;
                return (
                  <div
                    key={wh.id}
                    className={`px-5 py-3 transition-colors duration-150 ease-out flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedWhId(wh.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-medium text-slate-900">{wh.code}</span>
                        <span className="font-medium text-slate-900 truncate">{wh.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {wh.plantName} · 저장위치 {locCount}개
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <ActiveStatusLabel active={wh.active} />
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openEditWarehouseModal(wh)}
                        title="창고 정보 수정"
                        aria-label={`${wh.name} 정보 수정`}
                        className="p-1.5 text-slate-400 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors duration-150 ease-out"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Storage Locations Table */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-slate-900">소속 저장위치 목록</h2>
                <p className="mt-1 text-xs text-slate-500">
                  입고 시 활성 창고에 속한 사용중 저장위치만 선택할 수 있습니다
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{visibleLocations.length}건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">위치코드</th>
                    <th className="py-3 px-4">소속 창고</th>
                    <th className="py-3 px-4">저장위치명</th>
                    <th className="py-3 px-4">보관 구역</th>
                    <th className="py-3 px-4 text-right">보관 품목수</th>
                    <th className="py-3 px-4">상태</th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleLocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        선택한 창고에 등록된 저장위치가 없습니다
                      </td>
                    </tr>
                  ) : (
                    visibleLocations.map((loc) => {
                      const wh = warehouses.find((w) => w.id === loc.warehouseId);
                      const storedCount = stockBalances.filter(
                        (b) => b.storageLocationId === loc.id && b.qtyOnHand > 0
                      ).length;
                      return (
                        <tr key={loc.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">{loc.code}</td>
                          <td className="py-3 px-4 text-slate-700">{wh?.name}</td>
                          <td className="py-3 px-4 font-medium text-slate-900">{loc.name}</td>
                          <td className="py-3 px-4 text-slate-600">{loc.zone}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {storedCount}종
                          </td>
                          <td className="py-3 px-4">
                            <ActiveStatusLabel active={loc.active} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEditLocationModal(loc)}
                              className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              수정
                            </button>
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

      {/* Warehouse Create / Edit Modal */}
      <Modal
        open={whModalOpen}
        onClose={() => setWhModalOpen(false)}
        title={editingWh ? `창고 정보 수정 (${editingWh.code})` : '신규 창고 등록'}
        subtitle="공장(Plant)과 별개의 독립 창고 단위 및 사용 상태를 관리합니다"
        footer={
          <>
            <button
              type="button"
              onClick={() => setWhModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              취소
            </button>
            <button
              type="submit"
              form="warehouse-form"
              className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out"
            >
              {editingWh ? '수정 저장' : '등록 저장'}
            </button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={handleSaveWarehouse} className="space-y-4">
          {whFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{whFormError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="창고 코드" required hint={editingWh ? '코드는 수정할 수 없습니다' : '예: WH-04'}>
              <TextInput
                value={whCode}
                disabled={Boolean(editingWh)}
                onChange={(e) => setWhCode(e.target.value)}
                placeholder="WH-04"
              />
            </FormField>
            <FormField label="소속 공장명" required hint="예: 안산 1공장">
              <TextInput
                value={whPlantName}
                onChange={(e) => setWhPlantName(e.target.value)}
                placeholder="안산 1공장"
              />
            </FormField>
          </div>
          <FormField label="창고명" required>
            <TextInput
              value={whName}
              onChange={(e) => setWhName(e.target.value)}
              placeholder="제3완제품·출하창고"
            />
          </FormField>
          <FormField label="사용 상태">
            <SelectInput
              value={whActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e) => setWhActive(e.target.value === 'ACTIVE')}
            >
              <option value="ACTIVE">사용중</option>
              <option value="INACTIVE">비활성</option>
            </SelectInput>
          </FormField>
        </form>
      </Modal>

      {/* Storage Location Create / Edit Modal */}
      <Modal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        title={editingLoc ? `저장위치 수정 (${editingLoc.code})` : '저장위치 추가'}
        subtitle="창고 하위의 저장위치 상세 정보 및 활성 상태를 설정합니다"
        footer={
          <>
            <button
              type="button"
              onClick={() => setLocModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out"
            >
              취소
            </button>
            <button
              type="submit"
              form="create-loc-form"
              className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out"
            >
              {editingLoc ? '수정 저장' : '추가 저장'}
            </button>
          </>
        }
      >
        <form id="create-loc-form" onSubmit={handleSaveLocation} className="space-y-4">
          {locFormError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{locFormError}</div>
          )}
          <FormField label="소속 창고" required>
            <SelectInput
              value={whId}
              disabled={Boolean(editingLoc)}
              onChange={(e) => setWhId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name} ({w.plantName})
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="저장위치 코드" required hint={editingLoc ? '코드는 수정할 수 없습니다' : '예: LOC-A3'}>
              <TextInput
                value={locCode}
                disabled={Boolean(editingLoc)}
                onChange={(e) => setLocCode(e.target.value)}
                placeholder="LOC-A3"
              />
            </FormField>
            <FormField label="보관 구역" required>
              <TextInput value={locZone} onChange={(e) => setLocZone(e.target.value)} placeholder="정밀부품 존" />
            </FormField>
          </div>
          <FormField label="저장위치명" required>
            <TextInput
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              placeholder="A동 3열 전자부품 랙"
            />
          </FormField>
          <FormField label="사용 상태">
            <SelectInput
              value={locActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e) => setLocActive(e.target.value === 'ACTIVE')}
            >
              <option value="ACTIVE">사용중</option>
              <option value="INACTIVE">비활성</option>
            </SelectInput>
          </FormField>
        </form>
      </Modal>
    </div>
  );
};

