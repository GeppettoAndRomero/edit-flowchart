/**
 * ErrorToast コンポーネント
 * エラーメッセージをトースト形式で表示
 * - 4秒後に自動消去
 * - 閉じるボタンで手動消去可能
 */

import { useEffect, useCallback } from 'preact/hooks';
import { ui } from '@/i18n/ui';

export interface ErrorToastProps {
  id: string;
  message: string;
  onClose: (id: string) => void;
  locale?: string;
}

const AUTO_DISMISS_MS = 4000;

export function ErrorToast({ id, message, onClose, locale = 'en' }: ErrorToastProps) {
  const t = (ui as any)[locale] ?? ui.en;
  const handleClose = useCallback(() => {
    onClose(id);
  }, [id, onClose]);

  // 4秒後に自動消去
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [handleClose]);

  return (
    <div
      className="error-toast"
      role="alert"
      aria-live="polite"
    >
      <div className="error-toast__content">
        <span className="error-toast__icon" aria-hidden="true">
          ⚠
        </span>
        <span className="error-toast__message">{message}</span>
      </div>
      <button
        type="button"
        className="error-toast__close"
        onClick={handleClose}
        aria-label={t.close}
      >
        ✕
      </button>
    </div>
  );
}
