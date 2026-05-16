'use client';

import { useEffect, useState } from 'react';

/**
 * Datetime input that submits a proper ISO 8601 string (with timezone)
 * via a hidden field, while displaying a friendly local datetime-local picker.
 *
 * Why this exists: <input type="datetime-local"> submits "2024-12-25T14:00"
 * with no timezone, which PostgreSQL stores as UTC, making sessions appear
 * 5.5 hours later than intended for users in India.
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

  // Convert any existing ISO value back to a local-time string for display
  useEffect(() => {
    if (!defaultValue) return;
    try {
      const d = new Date(defaultValue);
      if (isNaN(d.getTime())) return;
      // Convert to local-time string in YYYY-MM-DDTHH:mm format
      const pad = (n: number) => String(n).padStart(2, '0');
      const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setLocal(v);
      setIso(d.toISOString());
    } catch {}
  }, [defaultValue]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocal(v);
    if (!v) {
      setIso('');
      return;
    }
    // new Date("2024-12-25T14:00") interprets as LOCAL time in the browser
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      setIso(d.toISOString());
    }
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
    </>
  );
}
