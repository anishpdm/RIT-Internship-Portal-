'use client';

import { useState } from 'react';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

interface Row {
  email: string;
  full_name?: string;
  phone?: string;
}

interface ImportResult {
  created: number;
  enrolled: number;
  skipped: number;
  errors: string[];
}

export default function CsvImportForm({
  internshipId,
  importAction,
}: {
  internshipId: string;
  importAction: (
    internshipId: string,
    rows: Row[],
  ) => Promise<ImportResult>;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function parseCsv(text: string): Row[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    // Detect header
    const first = lines[0].toLowerCase();
    let dataStart = 0;
    let cols = { email: 0, full_name: 1, phone: 2 };

    if (first.includes('email')) {
      const headers = lines[0]
        .split(',')
        .map((h) => h.trim().toLowerCase().replace(/[" ]/g, '_'));
      cols = {
        email: headers.indexOf('email'),
        full_name:
          headers.indexOf('full_name') >= 0
            ? headers.indexOf('full_name')
            : headers.indexOf('name'),
        phone: headers.indexOf('phone'),
      };
      dataStart = 1;
    }

    const result: Row[] = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cells = lines[i]
        .split(',')
        .map((c) => c.trim().replace(/^"|"$/g, ''));
      const email = cols.email >= 0 ? cells[cols.email] : '';
      if (!email) continue;
      result.push({
        email,
        full_name: cols.full_name >= 0 ? cells[cols.full_name] : '',
        phone: cols.phone >= 0 ? cells[cols.phone] : '',
      });
    }
    return result;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseErr(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setParseErr(
          'No valid rows found. Make sure the CSV has at least an email column.',
        );
        setRows([]);
      } else {
        setRows(parsed);
      }
    } catch (err: any) {
      setParseErr(err?.message ?? 'Failed to read file');
      setRows([]);
    }
  }

  async function onImport() {
    if (rows.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await importAction(internshipId, rows);
      setResult(r);
      if (r.errors.length === 0 || r.created + r.enrolled > 0) {
        setRows([]);
        setFilename('');
      }
    } catch (e: any) {
      setParseErr(e?.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="card">
        <p className="eyebrow mb-3">Step 1 — Upload CSV</p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="field"
        />
        <p className="text-xs mt-3" style={{ color: 'var(--ink-500)' }}>
          Expected columns:{' '}
          <code>email, full_name, phone</code> (header row optional).{' '}
          <a
            href="data:text/csv;charset=utf-8,email,full_name,phone%0Aanjali@example.com,Anjali%20Krishnan,9876543210%0Aravi@example.com,Ravi%20Menon,9988776655"
            download="rit-students-template.csv"
            className="link"
          >
            Download sample CSV →
          </a>
        </p>

        {parseErr && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-md text-sm mt-3"
            style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{parseErr}</span>
          </div>
        )}

        {filename && (
          <p
            className="text-sm mt-3 flex items-center gap-2"
            style={{ color: 'var(--ink-700)' }}
          >
            <FileSpreadsheet size={14} /> <strong>{filename}</strong> · {rows.length}{' '}
            student{rows.length === 1 ? '' : 's'} parsed
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="card p-0 overflow-hidden table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Email</th>
                  <th>Full name</th>
                  <th>Phone</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs" style={{ color: 'var(--ink-500)' }}>
                      {idx + 1}
                    </td>
                    <td className="text-sm font-mono">{r.email}</td>
                    <td className="text-sm">{r.full_name ?? '—'}</td>
                    <td className="text-sm">{r.phone ?? '—'}</td>
                    <td>
                      <button
                        onClick={() => removeRow(idx)}
                        className="btn btn-ghost text-xs"
                        type="button"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onImport}
              disabled={busy}
              className="btn btn-primary"
            >
              <Upload size={14} />{' '}
              {busy
                ? 'Importing…'
                : `Import & enrol ${rows.length} student${rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="card">
          <p className="eyebrow mb-3">Result</p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="stat-num" style={{ color: 'var(--green-700)' }}>
                {result.created}
              </p>
              <p className="stat-label">new accounts</p>
            </div>
            <div>
              <p className="stat-num" style={{ color: 'var(--accent)' }}>
                {result.enrolled}
              </p>
              <p className="stat-label">enrolled</p>
            </div>
            <div>
              <p className="stat-num" style={{ color: 'var(--ink-500)' }}>
                {result.skipped}
              </p>
              <p className="stat-label">skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="eyebrow mb-2" style={{ color: 'var(--red-700)' }}>
                Issues ({result.errors.length})
              </p>
              <ul
                className="text-sm space-y-1"
                style={{ color: 'var(--ink-700)' }}
              >
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle
                      size={12}
                      className="mt-1 shrink-0"
                      style={{ color: 'var(--red-700)' }}
                    />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length === 0 && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
              style={{ background: 'var(--green-soft)', color: 'var(--green-700)' }}
            >
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>All rows imported successfully.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
