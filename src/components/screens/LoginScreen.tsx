import React, { useState } from 'react';
import { AlertCircle, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { MOCK_USERS } from '../../data/mockData';
import { useErp } from '../../context/ErpContext';
import { FormField, TextInput } from '../common/FormControls';

// Screen Owner: B (Auth & RBAC integration) / Design: A
export const LoginScreen: React.FC = () => {
  const { loginAs, sessionExpiredReason } = useErp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found || password.length < 4) {
      setError('등록된 사내 이메일과 비밀번호(4자 이상)를 확인해 주세요.');
      return;
    }
    setError(null);
    loginAs(found.id);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6" data-screen-id="SCR-AUTH-001" data-spec-id="UI-04" data-owner="B">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Info Panel */}
        <div className="lg:col-span-5 bg-[#0F172A] text-white p-8 flex flex-col justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight">차곡ERP</div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              제조기업 구매요청·승인·내부 발주·입고·재고 원장 관리 및 통합 AI Assistant 업무 시스템
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="text-xs font-medium text-slate-300">업무 흐름 및 역할 체계</div>
            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="font-mono text-slate-500">01.</span>
                <span>구매 요청자 · 구매요청 초안 작성 및 제출</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-slate-500">02.</span>
                <span>승인자 · 제출된 구매요청 검토 및 승인·반려</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-slate-500">03.</span>
                <span>구매 담당자 · 승인 문서 기반 내부 발주 생성 및 인쇄</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-slate-500">04.</span>
                <span>창고 담당자 · 부분 입고 처리 및 재고 원장 관리</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400">
            차곡제조 자재·구매 통합 관리
          </div>
        </div>

        {/* Right Login Form & Role Quick Switch */}
        <div className="lg:col-span-7 p-8">
          <h1 className="text-lg font-semibold text-slate-900">사내 ERP 로그인</h1>
          <p className="mt-1 text-xs text-slate-500">
            사내 계정으로 로그인하거나 아래 역할별 테스트 계정을 선택해 접속할 수 있습니다
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {sessionExpiredReason && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{sessionExpiredReason}</span>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <FormField label="사내 이메일" required>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@chagok-mfg.co.kr"
              />
            </FormField>

            <FormField label="비밀번호" required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
              />
            </FormField>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <KeyRound className="w-4 h-4" strokeWidth={1.5} />
              로그인
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-800">역할별 빠른 접속</span>
              <span className="text-xs text-slate-500">권한별 화면 확인용</span>
            </div>

            {MOCK_USERS.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                모크 사용자 데이터가 주석 처리되어 있습니다. 실 데이터 연동 시 <span className="font-mono">MOCK_USERS</span> 또는 인증 API(<span className="font-mono">/api/v1/auth/login</span>)를 연결해 주세요.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOCK_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => loginAs(u.id)}
                    className="flex items-center justify-between p-3 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors duration-150 ease-out group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
                        <ShieldCheck
                          className="w-4 h-4 text-slate-400 group-hover:text-brand-600 shrink-0"
                          strokeWidth={1.5}
                        />
                        <span>{u.name}</span>
                        <span className="text-slate-400 font-normal">·</span>
                        <span className="text-brand-600 font-medium">{u.roleLabel}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 truncate pl-6">
                        {u.department} · {u.email}
                      </div>
                    </div>
                    <ArrowRight
                      className="w-4 h-4 text-slate-400 group-hover:text-brand-600 shrink-0"
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
