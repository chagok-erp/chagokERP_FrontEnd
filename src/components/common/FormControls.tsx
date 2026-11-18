import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export const SortableHeader: React.FC<{
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
}> = ({ label, active, direction, onClick, align = 'left' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 text-xs font-medium transition-colors duration-150 ease-out hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 rounded ${
      align === 'right' ? 'flex-row-reverse' : ''
    } ${active ? 'text-slate-900' : 'text-slate-500'}`}
  >
    <span>{label}</span>
    {active ? (
      direction === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-slate-700 shrink-0" strokeWidth={1.5} />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-slate-700 shrink-0" strokeWidth={1.5} />
      )
    ) : (
      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
    )}
  </button>
);

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, children }) => (
  <div className="space-y-2">
    <label className="block text-xs font-medium text-slate-700">
      {label}
      {required && <span className="text-red-600 ml-1">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-red-600">{error}</p>
    ) : hint ? (
      <p className="text-xs text-slate-500">{hint}</p>
    ) : null}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    {...props}
    className={`w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
  />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <select
    {...props}
    className={`w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
  >
    {children}
  </select>
);

export const SearchToolbar: React.FC<{
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}> = ({ searchValue, onSearchChange, searchPlaceholder = '검색', leftSlot, rightSlot }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3">
    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
      <div className="relative w-72 max-w-full">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg transition-colors duration-150 ease-out focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600"
        />
      </div>
      {leftSlot}
    </div>
    {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
  </div>
);
