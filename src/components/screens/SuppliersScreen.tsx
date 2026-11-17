import React, { useMemo, useState } from 'react';
import { Info, Plus } from 'lucide-react';
import { useErp } from '../../context/ErpContext';
import { Supplier } from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { FormField, SearchToolbar, SelectInput, SortableHeader, SortDirection, TextInput } from '../common/FormControls';
import { Modal } from '../common/Modal';
import { ScreenStateGate } from '../common/StateOverlay';
import { ActiveStatusLabel } from '../common/StatusLabel';

type SupplierSortKey = 'code' | 'name' | 'active';

// Screen Owner: A | Spec ID: SUP-01
export const SuppliersScreen: React.FC = () => {
  const { suppliers, hasAnyRole, createSupplier, updateSupplier, pushToast } = useErp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortKey, setSortKey] = useState<SupplierSortKey>('code');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSup, setEditingSup] = useState<Supplier | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessNo, setBusinessNo] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const canEdit = hasAnyRole(['PURCHASER', 'ADMIN']);

  const toggleSort = (key: SupplierSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const base = suppliers.filter((s) => {
      if (statusFilter === 'ACTIVE' && !s.active) return false;
      if (statusFilter === 'INACTIVE' && s.active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (sortKey) {
        case 'code':
          return a.code.localeCompare(b.code) * dir;
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'active':
          return (Number(a.active) - Number(b.active)) * dir;
      }
    });
  }, [suppliers, search, statusFilter, sortKey, sortDir]);

  const openCreateModal = () => {
    setEditingSup(null);
    setCode('');
    setName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setBusinessNo('');
    setActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSup(s);
    setCode(s.code);
    setName(s.name);
    setContactName(s.contactName);
    setPhone(s.phone);
    setEmail(s.email);
    setBusinessNo(s.businessNo);
    setActive(s.active);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const res = editingSup
      ? updateSupplier(editingSup.id, {
          name,
          contactName,
          phone,
          email,
          businessNo,
          active,
        })
      : createSupplier({
          code,
          name,
          contactName,
          phone,
          email,
          businessNo,
          active,
        });
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    pushToast('success', editingSup ? '공급업체 수정 완료' : '공급업체 등록 완료', res.message);
    setFormError(null);
    setModalOpen(false);
  };

  return (
    <div data-screen-id="SCR-SUP-001" data-spec-id="SUP-01" data-owner="A">
      <PageHeader
        title="공급업체 관리"
        subtitle="내부 구매발주 생성 및 발주서 인쇄 시 참조되는 공급업체 연락처 정보"
        actions={
          <button
            type="button"
            disabled={!canEdit}
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            공급업체 등록
          </button>
        }
      />

      <ScreenStateGate
        screenId="suppliers"
        emptyTitle="등록된 공급업체가 없습니다"
        emptyDescription="구매발주 생성을 위해 활성 공급업체 정보를 먼저 등록해 주세요."
        emptyActionLabel="전체 목록 복원"
      >
        <div className="space-y-4">
          <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.5} />
            <span>
              공급업체 연락처는 내부 발주서 조회 및 인쇄 표시용이며 외부 자동 주문 발송에는 사용하지 않습니다
            </span>
          </div>

          <SearchToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="업체코드, 업체명, 담당자, 전화번호 검색"
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
              <span className="text-xs text-slate-500 tabular-nums">총 {filtered.length}개 업체</span>
            }
          />

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">
                      <SortableHeader label="업체코드" active={sortKey === 'code'} direction={sortDir} onClick={() => toggleSort('code')} />
                    </th>
                    <th className="py-3 px-4">
                      <SortableHeader label="공급업체명" active={sortKey === 'name'} direction={sortDir} onClick={() => toggleSort('name')} />
                    </th>
                    <th className="py-3 px-4">사업자등록번호</th>
                    <th className="py-3 px-4">담당자</th>
                    <th className="py-3 px-4">전화번호</th>
                    <th className="py-3 px-4">이메일</th>
                    <th className="py-3 px-4">
                      <SortableHeader label="상태" active={sortKey === 'active'} direction={sortDir} onClick={() => toggleSort('active')} />
                    </th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">{s.code}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{s.name}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{s.businessNo || '-'}</td>
                        <td className="py-3 px-4 text-slate-700">{s.contactName || '-'}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{s.phone}</td>
                        <td className="py-3 px-4 text-slate-600">{s.email || '-'}</td>
                        <td className="py-3 px-4">
                          <ActiveStatusLabel active={s.active} />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEditModal(s)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                const res = updateSupplier(s.id, { active: !s.active });
                                pushToast(res.ok ? 'info' : 'error', res.ok ? '상태 변경' : '권한 오류', res.message);
                              }}
                              className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {s.active ? '비활성화' : '활성화'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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
        title={editingSup ? `공급업체 정보 수정 (${editingSup.code})` : '공급업체 신규 등록'}
        subtitle="활성 공급업체만 구매발주에서 선택할 수 있습니다"
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
              form="create-supplier-form"
              className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out"
            >
              {editingSup ? '수정 저장' : '등록 저장'}
            </button>
          </>
        }
      >
        <form id="create-supplier-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="업체 코드" required hint={editingSup ? '코드는 수정할 수 없습니다' : '예: SUP-005'}>
              <TextInput
                value={code}
                disabled={Boolean(editingSup)}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SUP-005"
              />
            </FormField>
            <FormField label="사업자등록번호">
              <TextInput value={businessNo} onChange={(e) => setBusinessNo(e.target.value)} placeholder="123-81-00000" />
            </FormField>
          </div>
          <FormField label="공급업체명" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="(주)성진정공" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="담당자명" hint="선택 입력">
              <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="홍길동 과장" />
            </FormField>
            <FormField label="전화번호" required>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="031-000-0000" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="이메일" hint="선택 입력 (입력 시 이메일 형식 검증)">
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.co.kr" />
            </FormField>
            <FormField label="사용 상태">
              <SelectInput
                value={active ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setActive(e.target.value === 'ACTIVE')}
              >
                <option value="ACTIVE">사용중</option>
                <option value="INACTIVE">비활성</option>
              </SelectInput>
            </FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
};
