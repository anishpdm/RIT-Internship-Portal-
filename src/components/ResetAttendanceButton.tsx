'use client';

import { useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface Props {
  sessionId: string;
  studentIds: string[];
  returnUrl: string;
  count: number;
  resetAction: (formData: FormData) => Promise<void>;
}

export default function ResetAttendanceButton({ sessionId, studentIds, returnUrl, count, resetAction }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(
      `Clear all ${count} marked attendance record${count !== 1 ? 's' : ''} for this session and start fresh?`
    )) {
      e.preventDefault();
    }
  }

  return (
    <form action={resetAction} onSubmit={handleSubmit}>
      <input type="hidden" name="session_id" value={sessionId}/>
      <input type="hidden" name="return_url" value={returnUrl}/>
      {studentIds.map(id => (
        <input key={id} type="hidden" name="student_id" value={id}/>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-ghost text-sm"
        style={{ color: 'var(--red-700)', borderColor: 'rgba(239,68,68,.25)' }}
      >
        {pending
          ? <><Loader2 size={13} className="animate-spin"/> Resetting…</>
          : <><Trash2 size={13}/> Reset attendance</>
        }
      </button>
    </form>
  );
}
