'use client';

import { useEffect, useState } from 'react';
import { isoToISTLocalInput, istLocalInputToISO } from '@/lib/utils';

/**
 * Datetime input that ALWAYS treats input/output as IST (Asia/Kolkata),
 * regardless of the browser's local timezone.
 *
 * The visible <input type="datetime-local"> shows IST date+time.
 * The hidden field submits a proper UTC ISO 8601 string for Postgres.
 */
export default function DateTimeField({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [local, setLocal] = useState('');
  const [iso, setIso] = useState('');

  // Convert any existing UTC ISO value back to IST-formatted local-input string
  useEffect(() => {
    if (!defaultValue) return;
    const v = isoToISTLocalInput(defaultValue);
    if (v) {
      setLocal(v);
      setIso(new Date(defaultValue).toISOString());
    }
  }, [defaultValue]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocal(v);
    if (!v) {
      setIso('');
      return;
    }
    // Treat the naive datetime-local string as IST and convert to UTC for the DB
    const utc = istLocalInputToISO(v);
    if (utc) setIso(utc);
  }

  return (
    <>
      <input
        type="datetime-local"
        value={local}
        onChange={onChange}
        className="field"
        required={required}
      />
      <input type="hidden" name={name} value={iso} />
      <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
        Time in IST (Asia/Kolkata).
      </p>
    </>
  );
}
