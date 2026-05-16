'use client';

import { useState } from 'react';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SubmissionForm({
  assignmentId,
  allowGithub,
  allowFile,
  action,
  defaultGithub,
  defaultNotes,
}: {
  assignmentId: string;
  allowGithub: boolean;
  allowFile: boolean;
  action: (formData: FormData) => Promise<void>;
  defaultGithub: string;
  defaultNotes: string;
}) {
  const [github, setGithub] = useState(defaultGithub);
  const [notes, setNotes] = useState(defaultNotes);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setErr(null);
    setUploaded(false);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const path = `${user.id}/${assignmentId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('submissions')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from('submissions')
        .getPublicUrl(path);
      setFileUrl(urlData.publicUrl);
      setUploaded(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('assignment_id', assignmentId);
      fd.append('github_url', github);
      fd.append('file_url', fileUrl);
      fd.append('notes', notes);
      await action(fd);
    } catch (e: any) {
      setErr(e?.message ?? 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl space-y-5">
      {allowGithub && (
        <div>
          <label className="field-label">GitHub URL</label>
          <input
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="https://github.com/your-username/repo"
            className="field"
          />
        </div>
      )}

      {allowFile && (
        <div>
          <label className="field-label">File upload</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setUploaded(false);
                setFileUrl('');
              }}
              className="field flex-1"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn btn-ghost"
            >
              <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {uploaded && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <CheckCircle2 size={12} /> File uploaded
            </p>
          )}
        </div>
      )}

      <div>
        <label className="field-label">Notes for mentor (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="field"
          placeholder="Anything the mentor should know about your approach…"
        />
      </div>

      {err && (
        <p className="text-sm text-red-700 flex items-center gap-1">
          <AlertCircle size={14} /> {err}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || (!github && !fileUrl)}
          className="btn btn-primary"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
