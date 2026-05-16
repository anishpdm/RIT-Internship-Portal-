'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface HiddenField {
  name: string;
  value: string;
}

/**
 * Renders a delete button that opens a confirmation modal before
 * actually submitting the destructive server action.
 *
 * The modal is portaled to document.body so it never lives inside
 * another <form> (which HTML disallows).
 */
export default function ConfirmDeleteButton({
  action,
  fields,
  itemName,
  itemType = 'item',
  warning,
  buttonLabel,
  iconOnly = false,
  buttonClass = 'btn btn-danger text-xs',
}: {
  action: (formData: FormData) => Promise<void> | Promise<unknown>;
  fields: HiddenField[];
  itemName: string;
  itemType?: string;
  /** Extra warning text shown below the main message — for high-impact deletes */
  warning?: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  buttonClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  // createPortal needs the document to be available
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass}
      >
        <Trash2 size={14} />
        {!iconOnly && (buttonLabel ?? ' Delete')}
      </button>

      {open && mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: 'rgba(15, 23, 42, 0.5)' }}
            onClick={() => !busy && setOpen(false)}
          >
            <div
              className="card max-w-md w-full"
              style={{ boxShadow: 'var(--shadow-lg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--red-soft)',
                    color: 'var(--red-700)',
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-bold text-lg capitalize">
                      Delete {itemType}?
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={busy}
                      className="btn btn-ghost p-1 -mr-2 -mt-1"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p
                    className="text-sm mt-2 leading-relaxed"
                    style={{ color: 'var(--ink-700)' }}
                  >
                    You are about to permanently delete{' '}
                    <strong style={{ color: 'var(--ink-900)' }}>{itemName}</strong>.
                    This action cannot be undone.
                  </p>
                  {warning && (
                    <div
                      className="mt-3 text-xs px-3 py-2 rounded-md"
                      style={{
                        background: 'var(--red-soft)',
                        color: 'var(--red-700)',
                      }}
                    >
                      ⚠ {warning}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <form
                  action={async (fd: FormData) => {
                    setBusy(true);
                    await action(fd);
                  }}
                >
                  {fields.map((f) => (
                    <input
                      key={f.name}
                      type="hidden"
                      name={f.name}
                      value={f.value}
                    />
                  ))}
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn"
                    style={{
                      background: 'var(--red-700)',
                      color: 'white',
                      borderColor: 'var(--red-700)',
                    }}
                  >
                    <Trash2 size={14} />
                    {busy ? 'Deleting…' : 'Delete'}
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
