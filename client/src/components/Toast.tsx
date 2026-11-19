import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'error'
            ? AlertCircle
            : toast.type === 'info'
            ? Info
            : CheckCircle2;

        const borderBg =
          toast.type === 'error'
            ? 'border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 text-rose-800 dark:text-rose-300'
            : toast.type === 'info'
            ? 'border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300'
            : 'border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300';

        const iconColor =
          toast.type === 'error'
            ? 'text-rose-500'
            : toast.type === 'info'
            ? 'text-blue-500'
            : 'text-teal-600 dark:text-teal-400';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-xl transition-all animate-in slide-in-from-bottom-3 duration-200 ${borderBg}`}
          >
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <p className="text-xs font-bold text-stone-900 dark:text-white">
                  {toast.title}
                </p>
              )}
              <p className="text-xs text-stone-600 dark:text-slate-300 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-stone-400 hover:text-stone-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};