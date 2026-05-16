'use client';

import { Printer } from 'lucide-react';

export default function PrintButton({
  label = 'Print',
  className = 'btn btn-secondary',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${className} no-print`}
    >
      <Printer size={14} /> {label}
    </button>
  );
}
