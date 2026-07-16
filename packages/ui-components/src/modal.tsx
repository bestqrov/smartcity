'use client';

import React, {
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-full mx-4',
} as const;

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal title rendered in the header */
  title?: ReactNode;
  /** Description text rendered below the title */
  description?: ReactNode;
  /** Footer content (typically action buttons) */
  footer?: ReactNode;
  /** Width constraint */
  size?: keyof typeof sizeClasses;
  /** Hide the default close (X) button */
  hideCloseButton?: boolean;
  /** Disable closing when clicking the backdrop */
  disableBackdropClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  hideCloseButton = false,
  disableBackdropClose = false,
  className = '',
  children,
  ...rest
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ── Escape key ──────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  /* ── Body scroll lock ────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  /* ── Backdrop click ──────────────────────────────────── */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!disableBackdropClose && e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        className={[
          'relative w-full rounded-xl bg-white shadow-xl',
          'dark:bg-gray-900 dark:border dark:border-gray-700',
          'animate-in zoom-in-95 slide-in-from-bottom-4 duration-200',
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {/* ── Header ─────────────────────────────────────── */}
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-desc"
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  {description}
                </p>
              )}
            </div>

            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ── Body ───────────────────────────────────────── */}
        <div className="p-6">{children}</div>

        {/* ── Footer ─────────────────────────────────────── */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-6 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
