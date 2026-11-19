import React, { useEffect } from 'react';
import { AlertTriangle, LogOut, Trash2, X, Check } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  type = 'warning',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <LogOut className="h-6 w-6 text-rose-600 dark:text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
      default:
        return <Check className="h-6 w-6 text-teal-600 dark:text-teal-400" />;
    }
  };

  const getBadgeBg = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60';
      default:
        return 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900/60';
    }
  };

  const getConfirmBtnClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20';
      default:
        return 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-2xl transition-all scale-100 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 rounded-full p-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 dark:text-slate-400 transition"
          title="Tutup dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xs mb-3.5 ${getBadgeBg()}`}>
            {getIcon()}
          </div>

          <h3 className="text-base font-bold text-[#1A1A1A] dark:text-white">
            {title}
          </h3>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-slate-400 leading-relaxed max-w-xs">
            {message}
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition ${getConfirmBtnClass()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};