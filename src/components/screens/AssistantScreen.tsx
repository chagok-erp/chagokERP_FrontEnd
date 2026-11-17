import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Send,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { RAG_POLICY_DOCS, SAMPLE_DOCUMENT_PRESETS } from '../../data/mockData';
import { useErp } from '../../context/ErpContext';
import {
  AssistantMessage,
  DocumentAnalysisSession,
  DocumentReviewRow,
  MatchMethod,
} from '../../types/erp';
import { PageHeader } from '../common/AppShell';
import { ScreenStateGate } from '../common/StateOverlay';
import { MatchValidationLabel, PrStatusLabel } from '../common/StatusLabel';

// Screen Owner: Shared (Shell & Agent Chat: A | Document Attachment & Item Review Table: B)
// Spec ID: UI-03, AG-01~06, DOC-01~04, MATCH-01~03
const MATCH_METHOD_LABEL: Record<MatchMethod, string> = {
  EXACT_CODE: '코드 일치',
  SYNONYM_RULE: '유사어 규칙',
  ES_BM25: 'ES BM25',
  LLM_FALLBACK: 'LLM 비교',
  UNMATCHED: '미매칭',
};

function currentTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function createInitialMessages(): AssistantMessage[] {
  return [
    {
      id: 'msg-init-1',
      sender: 'ASSISTANT',
      timestamp: currentTimeStr(),
      text: '재고·공급업체 조회, 구매 규정 확인, 구매요청 초안 생성·수정을 대화로 요청하거나 Excel(.xlsx)·텍스트 PDF(.pdf) 구매문서를 첨부해 품목 검토 테이블에서 초안을 저장할 수 있습니다.',
    },
  ];
}

export const AssistantScreen: React.FC = () => {
  const {
    currentUser,
    materials,
    prs,
    suppliers,
    getLowStockMaterials,
    getMaterialsBelowThreshold,
    savePrDraft,
    setActiveScreen,
    pushToast,
  } = useErp();

  const activeMaterials = useMemo(() => materials.filter((m) => m.active), [materials]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<AssistantMessage[]>(createInitialMessages);
  const [inputText, setInputText] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'DOC_REVIEW' | 'AGENT_DRAFT'>('DOC_REVIEW');

  // Document Analysis Session State (Owner: B)
  const [docSession, setDocSession] = useState<DocumentAnalysisSession | null>(null);
  const [docErrorBanner, setDocErrorBanner] = useState<string | null>(null);
  const [docPrTitle, setDocPrTitle] = useState('');
  const [docNeededDate, setDocNeededDate] = useState('');
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  // RBAC-05: Reset chat/session state when user switches to prevent cross-user session leakage
  useEffect(() => {
    setMessages(createInitialMessages());
    setInputText('');
    setActiveDraftId(null);
    setDocSession(null);
    setDocErrorBanner(null);
    setDocPrTitle('');
    setDocNeededDate('');
    setIsAnalyzingDoc(false);
  }, [currentUser?.id]);

  // Scope activeDraft & docSession strictly to currentUser
  const activeDraft = useMemo(
    () =>
      prs.find((p) => p.id === activeDraftId && p.requesterId === currentUser?.id) ?? null,
    [prs, activeDraftId, currentUser?.id]
  );

  const scopedDocSession = useMemo(
    () => (docSession && (!docSession.ownerUserId || docSession.ownerUserId === currentUser?.id) ? docSession : null),
    [docSession, currentUser?.id]
  );

  const runDocumentPipeline = (presetKey: keyof typeof SAMPLE_DOCUMENT_PRESETS, customFileName?: string) => {
    setDocErrorBanner(null);
    setIsAnalyzingDoc(true);
    setRightTab('DOC_REVIEW');

    setTimeout(() => {
      const template = SAMPLE_DOCUMENT_PRESETS[presetKey];
      if (!template) {
        setIsAnalyzingDoc(false);
        const msg =
          '모크 샘플 데이터가 비활성화되어 있습니다. 실제 Document AI 분석 API(/api/v1/documents/analyze)를 연동해 주세요.';
        setDocErrorBanner(msg);
        pushToast('info', '문서 분석 연동 필요', msg);
        return;
      }
      const cloned: DocumentAnalysisSession = {
        ...template,
        id: `doc-sess-${Date.now()}`,
        ownerUserId: currentUser?.id,
        fileName: customFileName || template.fileName,
        uploadedAt: currentTimeStr(),
        rows: template.rows.map((r) => ({ ...r, candidates: [...r.candidates] })),
      };
      setDocSession(cloned);
      setDocPrTitle(`[문서분석] ${cloned.fileName.replace(/\.[^.]+$/, '')}`);
      setIsAnalyzingDoc(false);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-doc-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          linkedDocSessionId: cloned.id,
          text: `첨부 파일 [${cloned.fileName}] 분석을 완료했습니다. 우측 품목 검토 테이블에서 총 ${cloned.pipelineSummary.totalRows}건의 매칭 품목과 수량을 확인한 뒤 구매요청 초안을 저장해 주세요.`,
        },
      ]);
    }, 350);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'pdf'].includes(ext)) {
      const errMsg = `지원하지 않는 파일 형식(.${ext})입니다. Excel(.xlsx) 또는 텍스트 PDF(.pdf) 파일만 첨부할 수 있습니다 (.xls·.csv 제외).`;
      setDocErrorBanner(errMsg);
      pushToast('error', '파일 형식 오류', errMsg);
      return;
    }
    if (file.size === 0) {
      const errMsg = '빈 파일이 업로드되어 품목 행을 추출할 수 없습니다.';
      setDocErrorBanner(errMsg);
      pushToast('error', '빈 문서 오류', errMsg);
      return;
    }

    if (ext === 'pdf') {
      runDocumentPipeline('pdf_quote', file.name);
    } else if (file.name.includes('오류') || file.name.toLowerCase().includes('err')) {
      runDocumentPipeline('error_mixed', file.name);
    } else {
      runDocumentPipeline('excel_parts', file.name);
    }
  };

  const handleRowMaterialChange = (rowId: string, materialId: string) => {
    if (!docSession) return;
    const mat = materials.find((m) => m.id === materialId);
    setDocSession({
      ...docSession,
      rows: docSession.rows.map((r) => {
        if (r.rowId !== rowId) return r;
        if (!mat || !mat.active) {
          return {
            ...r,
            selectedMaterialId: null,
            selected: false,
            validationStatus: 'ERROR',
            validationMessage: '유효한 활성 품목을 선택해 주세요',
          };
        }
        const qtyOk = r.confirmedQty > 0;
        return {
          ...r,
          selectedMaterialId: mat.id,
          selected: qtyOk,
          validationStatus: qtyOk ? 'READY' : 'ERROR',
          validationMessage: qtyOk
            ? `사용자 확인 완료 (${mat.code} · 기준단위 ${mat.unit})`
            : '수량은 0보다 커야 합니다',
        };
      }),
    });
  };

  const handleRowQtyChange = (rowId: string, qty: number) => {
    if (!scopedDocSession) return;
    setDocSession({
      ...scopedDocSession,
      rows: scopedDocSession.rows.map((r) => {
        if (r.rowId !== rowId) return r;
        const selectedMat = materials.find((m) => m.id === r.selectedMaterialId);
        const hasMat = Boolean(r.selectedMaterialId);
        const unit = selectedMat?.unit ?? r.rawUnit;
        const isIntUnit = unit === 'EA' || unit === 'SET';
        const isIntValid = !isIntUnit || Number.isInteger(qty);
        const qtyOk = Number.isFinite(qty) && qty > 0 && isIntValid;
        return {
          ...r,
          confirmedQty: qty,
          selected: hasMat && qtyOk ? r.selected : false,
          validationStatus: !hasMat || !qtyOk ? 'ERROR' : r.validationStatus === 'ERROR' ? 'READY' : r.validationStatus,
          validationMessage: !Number.isFinite(qty) || qty <= 0
            ? '수량은 0보다 커야 합니다'
            : !isIntValid
              ? `${unit} 단위 품목은 정수 수량만 입력할 수 있습니다`
              : hasMat
                ? '수량 사용자 수정 완료'
                : r.validationMessage,
        };
      }),
    });
  };

  const handleRowSelectToggle = (rowId: string, checked: boolean) => {
    if (!scopedDocSession) return;
    setDocSession({
      ...scopedDocSession,
      rows: scopedDocSession.rows.map((r) => (r.rowId === rowId ? { ...r, selected: checked } : r)),
    });
  };

  const handleSaveReviewedDocToPr = () => {
    if (!scopedDocSession) return;
    const checkedRows = scopedDocSession.rows.filter(
      (r) => r.selected && r.selectedMaterialId && r.confirmedQty > 0
    );
    if (!checkedRows.length) {
      pushToast('error', '저장할 품목 없음', '최소 1개 이상의 유효한 품목을 확정 선택해 주세요.');
      return;
    }

    const seenMatIds = new Set<string>();
    for (const r of checkedRows) {
      if (seenMatIds.has(r.selectedMaterialId!)) {
        const dupMat = materials.find((m) => m.id === r.selectedMaterialId);
        const errMsg = `동일 품목(${dupMat?.code ?? r.selectedMaterialId})이 여러 행에 중복 선택되었습니다. 중복 행을 해제하거나 하나로 합쳐 주세요.`;
        setDocErrorBanner(errMsg);
        pushToast('error', '품목 중복 선택 오류', errMsg);
        return;
      }
      seenMatIds.add(r.selectedMaterialId!);
    }

    const res = savePrDraft({
      title: docPrTitle || `[문서분석] ${scopedDocSession.fileName}`,
      neededByDate: docNeededDate,
      source: 'DOCUMENT_AI',
      items: checkedRows.map((r) => ({
        materialId: r.selectedMaterialId!,
        requestedQty: r.confirmedQty,
        note: `문서 ${r.lineNo}행 (${MATCH_METHOD_LABEL[r.matchMethod]})`,
      })),
    });

    if (!res.ok || !res.data) {
      setDocErrorBanner(res.message);
      pushToast('error', '초안 저장 실패', res.message);
      return;
    }

    setDocErrorBanner(null);
    setDocSession({
      ...scopedDocSession,
      savedPrId: res.data.id,
      savedPrNumber: res.data.prNumber,
    });
    setActiveDraftId(res.data.id);
    pushToast('success', '문서 기반 초안 저장 완료', res.message);

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-saved-${Date.now()}`,
        sender: 'ASSISTANT',
        timestamp: currentTimeStr(),
        linkedDraftId: res.data!.id,
        linkedDraftVersion: res.data!.version,
        text: `검토 완료된 ${checkedRows.length}개 품목을 공통 구매요청 초안으로 저장했습니다. 생성된 문서는 [${res.data!.prNumber} (v${res.data!.version})]입니다.`,
      },
    ]);
  };

  // Conversational Agent Handler (Owner: A)
  const processUserPrompt = (rawText: string) => {
    const prompt = rawText.trim();
    if (!prompt) return;

    const userMsg: AssistantMessage = {
      id: `msg-u-${Date.now()}`,
      sender: 'USER',
      timestamp: currentTimeStr(),
      text: prompt,
    };

    const lower = prompt.toLowerCase();
    let replyMsg: AssistantMessage;

    if (
      prompt.includes('승인') ||
      prompt.includes('결제') ||
      prompt.includes('입고 처리') ||
      prompt.includes('발주 전송') ||
      prompt.includes('자동 발주')
    ) {
      if (prompt.includes('규정') || prompt.includes('가능한가요')) {
        replyMsg = {
          id: `msg-a-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          text: '구매 규정 검색 결과, 긴급 자재라 하더라도 승인 없는 선입고나 선결제, 외부 자동 발주는 허용되지 않습니다. 아래 규정 출처를 확인해 주세요.',
          citations: [RAG_POLICY_DOCS[1], RAG_POLICY_DOCS[0]].filter((c): c is NonNullable<typeof c> => Boolean(c)),
        };
      } else {
        replyMsg = {
          id: `msg-a-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          isBlockedNotice: true,
          text: '승인 확정, 발주 처리, 입고 등록, 결제 실행은 AI 실행 통제 정책상 허용되지 않습니다. AI Assistant는 조회·규정 확인·구매요청 초안 생성 및 수정까지만 수행하며, 승인 및 입고는 권한 있는 담당자가 직접 처리해야 합니다.',
        };
      }
    } else if (
      (prompt.includes('두 번째') || prompt.includes('첫 번째') || prompt.includes('수정') || prompt.includes('제외')) &&
      activeDraft &&
      activeDraft.status === 'DRAFT'
    ) {
      const currentItems = [...activeDraft.items];
      let nextItems = currentItems.map((i) => ({ materialId: i.materialId, requestedQty: i.requestedQty }));

      if (prompt.includes('두 번째') && prompt.includes('제외') && nextItems.length >= 2) {
        nextItems = nextItems.filter((_, idx) => idx !== 1);
      }
      if (prompt.includes('첫 번째') && /\d+/.test(prompt)) {
        const matchedNum = Number(prompt.match(/\d+/)?.[0] ?? 20);
        if (nextItems.length >= 1 && matchedNum > 0) {
          nextItems[0] = { ...nextItems[0], requestedQty: matchedNum };
        }
      }

      const modRes = savePrDraft({
        draftId: activeDraft.id,
        expectedVersion: activeDraft.version,
        title: activeDraft.title,
        neededByDate: activeDraft.neededByDate,
        source: 'AGENT',
        items: nextItems,
      });

      if (!modRes.ok || !modRes.data) {
        replyMsg = {
          id: `msg-a-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          isBlockedNotice: true,
          text: `초안 수정 중 오류가 발생했습니다: ${modRes.message}`,
        };
      } else {
        setRightTab('AGENT_DRAFT');
        replyMsg = {
          id: `msg-a-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          linkedDraftId: modRes.data.id,
          linkedDraftVersion: modRes.data.version,
          text: `[${modRes.data.prNumber}] 초안을 v${modRes.data.version}으로 수정 반영했습니다. 우측 '연동 구매요청 초안' 패널에서 변경된 품목과 수량을 확인하세요.`,
        };
      }
    } else if (
      prompt.includes('재고 부족') ||
      prompt.includes('부족 품목') ||
      prompt.includes('안전재고') ||
      prompt.includes('초안')
    ) {
      // D-06 / BR-027: Require explicit threshold or explicit safety-stock basis; re-prompt if omitted
      const thresholdMatch =
        prompt.match(/(\d+(?:\.\d+)?)\s*(?:개|ea|kg|m|set|l)?\s*(?:이하|미만|보다\s*적)/i) ||
        prompt.match(/(?:임계값|기준)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
      const userThreshold = thresholdMatch ? Number(thresholdMatch[1]) : null;
      const usesSafetyStock = prompt.includes('안전재고');

      if (!usesSafetyStock && (userThreshold === null || !Number.isFinite(userThreshold) || userThreshold <= 0)) {
        replyMsg = {
          id: `msg-a-${Date.now()}`,
          sender: 'ASSISTANT',
          timestamp: currentTimeStr(),
          text: '재고 부족 여부를 판단할 기준 수량(임계값)이 지정되지 않아 임의로 판정하지 않았습니다. "현재고 20 이하 품목 조회"처럼 기준 수량을 입력하시거나, "안전재고 미달 품목 기준으로 초안 만들어줘"라고 알려주세요.',
        };
      } else {
        const targetItems = userThreshold !== null ? getMaterialsBelowThreshold(userThreshold) : getLowStockMaterials();
        const basisLabel =
          userThreshold !== null ? `사용자 지정 임계값(${userThreshold} 이하)` : '안전재고 미달';

        if (targetItems.length === 0) {
          replyMsg = {
            id: `msg-a-${Date.now()}`,
            sender: 'ASSISTANT',
            timestamp: currentTimeStr(),
            text: `${basisLabel} 기준에 해당하는 재고 부족 품목이 없습니다. 특정 품목명과 수량을 말씀해 주시면 구매요청 초안을 생성해 드립니다.`,
          };
        } else if (prompt.includes('초안')) {
          const draftRes = savePrDraft({
            title: `[AI 요청] ${basisLabel} 자재 보충`,
            neededByDate: '',
            source: 'AGENT',
            items: targetItems.slice(0, 3).map((m) => ({
              materialId: m.id,
                  requestedQty:
                    m.unit === 'EA' || m.unit === 'SET'
                      ? Math.max(5, Math.ceil(m.shortage))
                      : Math.max(5, m.shortage),
                })),
              });

              if (!draftRes.ok || !draftRes.data) {
                replyMsg = {
                  id: `msg-a-${Date.now()}`,
                  sender: 'ASSISTANT',
                  timestamp: currentTimeStr(),
                  isBlockedNotice: true,
                  text: `초안 생성 권한 또는 검증 오류: ${draftRes.message}`,
                };
              } else {
                setActiveDraftId(draftRes.data.id);
                setRightTab('AGENT_DRAFT');
                replyMsg = {
                  id: `msg-a-${Date.now()}`,
                  sender: 'ASSISTANT',
                  timestamp: currentTimeStr(),
                  linkedDraftId: draftRes.data.id,
                  linkedDraftVersion: draftRes.data.version,
                  text: `${basisLabel} 품목 ${targetItems.length}종과 ${
                    suppliers.length > 0
                      ? `활성 공급업체(${suppliers[0].name} 외 ${Math.max(0, suppliers.length - 1)}곳)`
                      : '등록된 공급업체'
                  } 및 구매 규정을 조회하여 [${draftRes.data.prNumber} (v${draftRes.data.version})] 초안을 생성했습니다. 후속 대화로 품목 제외나 수량 수정을 이어서 지시할 수 있습니다.`,
                  toolCard: {
                    toolName: `${basisLabel} 품목 조회 결과`,
                    summary: `${basisLabel} 기준 ${targetItems.length}종`,
                    rows: targetItems.map((m) => ({
                      col1: m.code,
                      col2: m.name,
                      col3: `현재 ${m.currentStock}${m.unit}`,
                      col4: `부족 ${m.shortage}${m.unit}`,
                    })),
                  },
                  citations: [RAG_POLICY_DOCS[0]].filter((c): c is NonNullable<typeof c> => Boolean(c)),
                };
              }
            } else {
              replyMsg = {
                id: `msg-a-${Date.now()}`,
                sender: 'ASSISTANT',
                timestamp: currentTimeStr(),
                text: `${basisLabel} 기준 재고 부족 품목 ${targetItems.length}종을 조회했습니다. 이 품목들로 구매요청 초안을 만들려면 "안전재고 미달 품목 기준으로 초안 만들어줘"라고 입력해 주세요.`,
                toolCard: {
                  toolName: `${basisLabel} 품목 조회 결과`,
                  summary: `${basisLabel} 기준 ${targetItems.length}종`,
                  rows: targetItems.map((m) => ({
                    col1: m.code,
                    col2: m.name,
                    col3: `현재 ${m.currentStock}${m.unit}`,
                    col4: `부족 ${m.shortage}${m.unit}`,
                  })),
                },
              };
            }
          }
        } else if (prompt.includes('규정') || prompt.includes('부분 입고') || prompt.includes('잔량')) {
          replyMsg = {
            id: `msg-a-${Date.now()}`,
            sender: 'ASSISTANT',
            timestamp: currentTimeStr(),
            text:
              RAG_POLICY_DOCS.length > 0
                ? '사내 구매·입고 규정 문서 검색 결과입니다. 시행일 및 조항을 함께 안내합니다.'
                : '모크 규정 문서 데이터가 비활성화되어 있습니다. 실 사내 규정 RAG 문서를 연동해 주세요.',
            citations: [RAG_POLICY_DOCS[0], RAG_POLICY_DOCS[2]].filter((c): c is NonNullable<typeof c> => Boolean(c)),
          };
        } else if (lower.length < 6) {
          replyMsg = {
            id: `msg-a-${Date.now()}`,
            sender: 'ASSISTANT',
            timestamp: currentTimeStr(),
            text: '요청 의도를 정확히 파악하기 위해 품목명·수량을 알려주시거나 "재고 부족 품목 확인 후 초안 만들어줘"처럼 입력해 주세요. Excel(.xlsx) 또는 텍스트 PDF(.pdf) 문서가 있다면 파일 첨부 버튼을 이용해 주세요.',
          };
        } else {
          const lowItems = getLowStockMaterials();
          replyMsg = {
            id: `msg-a-${Date.now()}`,
            sender: 'ASSISTANT',
            timestamp: currentTimeStr(),
            text: `요청하신 내용을 확인했습니다. 현재 활성 품목 ${activeMaterials.length}종, 공급업체 ${suppliers.length}곳, 안전재고 미달 품목 ${lowItems.length}종이 조회됩니다. 초안 작성이 필요하시면 "재고 부족 품목 초안 만들어줘"를 입력하거나 견적서·발주요청 파일(.xlsx/.pdf)을 첨부해 주세요.`,
          };
        }

        setMessages((prev) => [...prev, userMsg, replyMsg]);
        setInputText('');
      };

      const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        processUserPrompt(inputText);
      };

      const selectedDocRowsCount = scopedDocSession
        ? scopedDocSession.rows.filter((r) => r.selected && r.selectedMaterialId && r.confirmedQty > 0).length
        : 0;

      const selectedDocAmount = scopedDocSession
        ? scopedDocSession.rows.reduce((sum, r) => {
            if (!r.selected || !r.selectedMaterialId || r.confirmedQty <= 0) return sum;
            const mat = materials.find((m) => m.id === r.selectedMaterialId);
            return sum + (mat ? mat.unitPrice * r.confirmedQty : 0);
          }, 0)
        : 0;

  return (
    <div data-screen-id="SCR-AI-001" data-spec-id="UI-03 / AG-01~06 / DOC-01~04" data-owner="공동">
      <PageHeader
        title="통합 AI Assistant"
        subtitle="대화형 업무 조회·구매 규정 확인 및 Excel·텍스트 PDF 구매문서 품목 분석"
      />

      <ScreenStateGate
        screenId="assistant"
        emptyTitle="대화 및 문서 분석 세션이 비어 있습니다"
        emptyDescription="대화를 시작하거나 구매요청 Excel·텍스트 PDF 문서를 첨부해 주세요."
        emptyActionLabel="새 작업 시작"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT: Conversational Agent & RAG + File Upload Trigger (5 cols, Owner: A) */}
          <div
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col h-[calc(100vh-192px)] min-h-[600px] overflow-hidden"
            data-owner="A"
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-700" strokeWidth={1.5} />
                <span className="text-xs font-medium text-slate-900">업무 대화 · 규정 조회</span>
              </div>
              <span className="text-xs text-slate-500">사용자: {currentUser?.name}</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-lg px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === 'USER'
                        ? 'bg-blue-700 text-white'
                        : msg.isBlockedNotice
                          ? 'bg-red-50 border border-red-200 text-red-900'
                          : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.isBlockedNotice && (
                      <div className="flex items-center gap-2 font-medium text-red-700 mb-1">
                        <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        실행 권한 제한 안내
                      </div>
                    )}
                    <p>{msg.text}</p>

                    {/* Tool Output Card */}
                    {msg.toolCard && (
                      <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 text-xs">
                        <div className="font-medium text-slate-900">{msg.toolCard.toolName}</div>
                        <div className="text-slate-500 mt-1 mb-2">{msg.toolCard.summary}</div>
                        {msg.toolCard.rows && (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {msg.toolCard.rows.map((r, i) => (
                              <div key={i} className="py-2 flex items-center justify-between gap-2">
                                <span className="font-mono text-slate-600">{r.col1}</span>
                                <span className="font-medium text-slate-900 flex-1 truncate">{r.col2}</span>
                                <span className="font-mono tabular-nums text-red-700 shrink-0">{r.col4}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* RAG Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.citations.map((cit, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
                            <div className="font-medium text-slate-900">
                              {cit.docTitle} · {cit.clause}
                            </div>
                            <div className="text-slate-500 mt-1">시행일: {cit.effectiveDate}</div>
                            <p className="mt-1 text-slate-700 leading-relaxed">{cit.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Linked PR Draft Link */}
                    {msg.linkedDraftId && (
                      <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-600">
                          연동 초안 v{msg.linkedDraftVersion}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveScreen('pr')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                        >
                          구매요청에서 확인
                          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="mt-1 text-xs font-mono text-slate-400">{msg.timestamp}</span>
                </div>
              ))}
            </div>

            {/* Quick Prompt Presets */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 space-y-2">
              <div className="text-xs font-medium text-slate-500">빠른 시나리오 질의</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    processUserPrompt('안전재고 미달 품목과 공급업체를 확인하고 규정을 검토해 PR 초안 만들어줘')
                  }
                  className="px-3 py-1 text-xs bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-900 rounded-lg text-slate-700 transition-colors duration-150 ease-out"
                >
                  안전재고 미달 초안 생성
                </button>
                <button
                  type="button"
                  disabled={!activeDraft || activeDraft.status !== 'DRAFT'}
                  onClick={() => processUserPrompt('두 번째 품목 제외하고 첫 번째 품목 수량 20으로 수정해줘')}
                  className="px-3 py-1 text-xs bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 rounded-lg text-slate-700 transition-colors duration-150 ease-out"
                >
                  후속 수정 (2번 제외·1번 20개)
                </button>
                <button
                  type="button"
                  onClick={() => processUserPrompt('재고 부족 품목 조회해줘')}
                  className="px-3 py-1 text-xs bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-900 rounded-lg text-slate-700 transition-colors duration-150 ease-out"
                >
                  재고 부족 기준 재질문
                </button>
                <button
                  type="button"
                  onClick={() => processUserPrompt('긴급 구매 시 무승인 발주나 선결제가 가능한가요?')}
                  className="px-3 py-1 text-xs bg-white border border-slate-200 hover:border-slate-400 hover:text-slate-900 rounded-lg text-slate-700 transition-colors duration-150 ease-out"
                >
                  구매 규정 질의
                </button>
                <button
                  type="button"
                  onClick={() => processUserPrompt('방금 만든 PR 바로 승인하고 결제까지 처리해줘')}
                  className="px-3 py-1 text-xs bg-white border border-slate-200 hover:border-red-300 hover:text-red-700 rounded-lg text-slate-700 transition-colors duration-150 ease-out"
                >
                  승인·결제 실행 통제 확인
                </button>
              </div>
            </div>

            {/* Input Form + Paperclip Attachment */}
            <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Excel(.xlsx) 또는 텍스트 PDF(.pdf) 구매문서 첨부"
                className="p-2 text-slate-600 hover:text-blue-700 hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors duration-150 ease-out shrink-0"
              >
                <Paperclip className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="품목 조회, 규정 질문, 초안 생성 및 수정 입력"
                className="flex-1 px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-lg transition-colors duration-150 ease-out focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out shrink-0"
              >
                <Send className="w-4 h-4" strokeWidth={1.5} />
                전송
              </button>
            </form>
          </div>

          {/* RIGHT: Document Attachment & Item Review Table (Owner: B) + Linked PR Draft Preview (7 cols) */}
          <div
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col h-[calc(100vh-192px)] min-h-[600px] overflow-hidden"
            data-screen-id={rightTab === 'DOC_REVIEW' ? 'SCR-AI-002' : 'SCR-AI-001'}
            data-owner="B"
          >
            {/* Panel Header + Mode Tabs */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRightTab('DOC_REVIEW')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                    rightTab === 'DOC_REVIEW'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  문서 분석 품목 검토 테이블
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('AGENT_DRAFT')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 ease-out whitespace-nowrap ${
                    rightTab === 'AGENT_DRAFT'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  연동 구매요청 초안 {activeDraft ? `(${activeDraft.prNumber})` : ''}
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap"
              >
                <Upload className="w-4 h-4" strokeWidth={1.5} />
                파일 첨부
              </button>
            </div>

            {rightTab === 'DOC_REVIEW' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Sample File Preset Bar */}
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">샘플 문서:</span>
                    <button
                      type="button"
                      onClick={() => runDocumentPipeline('excel_parts')}
                      className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors duration-150 ease-out"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                      생산1팀_부품요청.xlsx
                    </button>
                    <button
                      type="button"
                      onClick={() => runDocumentPipeline('pdf_quote')}
                      className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors duration-150 ease-out"
                    >
                      <FileText className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                      설비보전_견적서.pdf
                    </button>
                    <button
                      type="button"
                      onClick={() => runDocumentPipeline('error_mixed')}
                      className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors duration-150 ease-out"
                    >
                      <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
                      오류·미매칭 테스트.xlsx
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDocErrorBanner(
                        '지원하지 않는 스캔 이미지 PDF 또는 손상된 파일입니다. 텍스트 추출이 가능한 PDF와 Excel 파일만 지원합니다.'
                      )
                    }
                    className="text-xs text-slate-500 hover:text-red-700 underline"
                  >
                    파싱 오류 확인
                  </button>
                </div>

                {docErrorBanner && (
                  <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3 text-xs text-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.5} />
                      <span>{docErrorBanner}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocErrorBanner(null)}
                      className="text-xs font-medium underline shrink-0"
                    >
                      닫기
                    </button>
                  </div>
                )}

                {isAnalyzingDoc ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mb-3" />
                    <div className="text-xs font-medium text-slate-900">
                      문서 품목 추출 및 마스터 후보 대조 중
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      모호한 품목은 자동 확정하지 않고 사용자 검토 대상으로 표시합니다
                    </div>
                  </div>
                ) : !scopedDocSession ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3">
                      <FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900">구매문서를 첨부해 주세요</h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-md leading-relaxed">
                      Excel(.xlsx) 또는 텍스트 PDF(.pdf)를 업로드하거나 상단 샘플 문서를 선택하면 추출·매칭된 결과를 품목 검토 테이블에서 확인하고 초안으로 저장할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Analyzed Document Pipeline Summary */}
                    <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{scopedDocSession.fileName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-xs text-slate-500">{scopedDocSession.fileSizeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                        <span>총 {scopedDocSession.pipelineSummary.totalRows}행</span>
                        <span className="text-slate-300">·</span>
                        <span>규칙 {scopedDocSession.pipelineSummary.ruleMatched}</span>
                        <span className="text-slate-300">·</span>
                        <span>ES BM25 {scopedDocSession.pipelineSummary.esMatched}</span>
                        <span className="text-slate-300">·</span>
                        <span>LLM 보조 {scopedDocSession.pipelineSummary.llmAssisted}</span>
                      </div>
                    </div>

                    {/* Item Review Table */}
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">선택</th>
                            <th className="py-3 px-3">추출 원문 (품목·규격)</th>
                            <th className="py-3 px-3 whitespace-nowrap">매칭 단계</th>
                            <th className="py-3 px-3">ERP 매칭 품목 선택</th>
                            <th className="py-3 px-3 text-right w-24">수량</th>
                            <th className="py-3 px-3">검증 상태</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {scopedDocSession.rows.map((row: DocumentReviewRow) => {
                            const selectedMat = materials.find((m) => m.id === row.selectedMaterialId);
                            const rowUnit = selectedMat?.unit ?? row.rawUnit;
                            const isIntUnit = rowUnit === 'EA' || rowUnit === 'SET';
                            const canCheck = Boolean(
                              row.selectedMaterialId && row.confirmedQty > 0 && row.validationStatus !== 'ERROR'
                            );
                            return (
                              <tr key={row.rowId} className={row.selected ? 'bg-slate-50' : 'bg-white'}>
                                <td className="py-3 px-3 text-center align-top">
                                  <input
                                    type="checkbox"
                                    disabled={!canCheck}
                                    checked={row.selected}
                                    onChange={(e) => handleRowSelectToggle(row.rowId, e.target.checked)}
                                    className="mt-1 rounded border-slate-300 text-blue-700 disabled:opacity-40"
                                  />
                                </td>
                                <td className="py-3 px-3 align-top">
                                  <div className="font-medium text-slate-900">
                                    <span className="font-mono text-slate-400 mr-1">{row.lineNo}.</span>
                                    {row.rawName}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    코드: <span className="font-mono">{row.rawCode}</span> · {row.rawSpec} · 원문단위{' '}
                                    {row.rawUnit}
                                  </div>
                                  {row.validationMessage && (
                                    <div
                                      className={`mt-1 text-xs ${
                                        row.validationStatus === 'ERROR'
                                          ? 'text-red-700'
                                          : row.validationStatus === 'NEEDS_REVIEW'
                                            ? 'text-amber-700'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {row.validationMessage}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap text-xs font-medium text-slate-700">
                                  {MATCH_METHOD_LABEL[row.matchMethod]}
                                </td>
                                <td className="py-3 px-3 align-top min-w-[210px]">
                                  <select
                                    value={row.selectedMaterialId ?? ''}
                                    onChange={(e) => handleRowMaterialChange(row.rowId, e.target.value)}
                                    className={`w-full px-2 py-2 text-xs border rounded-lg bg-white ${
                                      !row.selectedMaterialId
                                        ? 'border-red-300 text-red-700'
                                        : 'border-slate-300 text-slate-900'
                                    }`}
                                  >
                                    <option value="">ERP 품목 선택</option>
                                    {row.candidates.length > 0 && (
                                      <optgroup label="매칭 추천 후보">
                                        {row.candidates.map((cand) => {
                                          const m = materials.find((x) => x.id === cand.materialId);
                                          if (!m || !m.active) return null;
                                          return (
                                            <option key={`cand-${m.id}`} value={m.id}>
                                              [추천 {cand.rank}순위 · {cand.matchBasis}] {m.code} {m.name} ({m.unit})
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                    <optgroup label="전체 활성 ERP 품목">
                                      {activeMaterials.map((m) => (
                                        <option key={m.id} value={m.id}>
                                          {m.code} · {m.name} ({m.unit})
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                  {selectedMat && (
                                    <div className="mt-1 text-xs text-slate-500 truncate">
                                      규격: {selectedMat.spec} · {selectedMat.unitPrice.toLocaleString()}원
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 align-top text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      step={isIntUnit ? 1 : '0.001'}
                                      value={row.confirmedQty}
                                      onChange={(e) => handleRowQtyChange(row.rowId, Number(e.target.value))}
                                      className={`w-16 px-2 py-1 text-right font-mono tabular-nums text-xs border rounded-lg ${
                                        row.confirmedQty <= 0
                                          ? 'border-red-400 bg-red-50 text-red-700'
                                          : 'border-slate-300 bg-white text-slate-900'
                                      }`}
                                    />
                                    <span className="text-xs font-mono text-slate-500">
                                      {rowUnit}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 align-top">
                                  <MatchValidationLabel status={row.validationStatus} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer: Save Reviewed Items to Shared PR Draft Service */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                      {scopedDocSession.savedPrNumber && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                          <span className="inline-flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                            공통 구매요청 초안 저장 완료: <strong className="font-mono">{scopedDocSession.savedPrNumber}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveScreen('pr')}
                            className="font-medium text-emerald-800 hover:underline inline-flex items-center gap-1"
                          >
                            구매요청에서 제출하기
                            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={docPrTitle}
                            onChange={(e) => setDocPrTitle(e.target.value)}
                            placeholder="저장할 구매요청 초안 제목"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <input
                          type="date"
                          value={docNeededDate}
                          onChange={(e) => setDocNeededDate(e.target.value)}
                          title="납품 필요일 (초안 저장 시 선택, 제출 시 필수)"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-600 font-mono tabular-nums">
                          선택 품목 <strong className="font-medium">{selectedDocRowsCount}건</strong> · 예상 총액{' '}
                          <strong className="font-medium">{selectedDocAmount.toLocaleString()}원</strong>
                        </div>
                        <button
                          type="button"
                          disabled={selectedDocRowsCount === 0}
                          onClick={handleSaveReviewedDocToPr}
                          className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg transition-colors duration-150 ease-out whitespace-nowrap"
                        >
                          검토 완료 품목으로 초안 저장
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* AGENT LINKED PR DRAFT PREVIEW */
              <div className="flex-1 overflow-y-auto p-5">
                {!activeDraft ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <p className="text-xs font-medium text-slate-700">현재 대화에 연동된 구매요청 초안이 없습니다</p>
                    <p className="mt-1 text-xs text-slate-500">
                      좌측 대화창에서 &ldquo;재고 부족 품목 조회 후 초안 생성&rdquo; 버튼을 실행해 보세요
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-medium text-slate-900">{activeDraft.prNumber}</span>
                          <span>·</span>
                          <span className="font-mono">버전 v{activeDraft.version}</span>
                          <span>·</span>
                          <span>최종 수정: {activeDraft.updatedAt}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-medium text-slate-900">{activeDraft.title}</h3>
                      </div>
                      <PrStatusLabel status={activeDraft.status} />
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="py-2 px-3 w-16">순번</th>
                            <th className="py-2 px-3">품목</th>
                            <th className="py-2 px-3 text-right">수량</th>
                            <th className="py-2 px-3 text-right">예상금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeDraft.items.map((item, idx) => (
                            <tr key={item.id}>
                              <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}번째</td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-slate-900">{item.materialName}</div>
                                <div className="text-xs font-mono text-slate-500">{item.materialCode}</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                {item.requestedQty.toLocaleString()} {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                {(item.requestedQty * item.estimatedUnitPrice).toLocaleString()}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500">
                        대화창에서 &ldquo;두 번째 품목 제외하고 첫 번째 수량 20&rdquo; 입력 시 실시간 반영됩니다
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveScreen('pr')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors duration-150 ease-out"
                      >
                        구매요청 화면에서 제출
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScreenStateGate>
    </div>
  );
};
