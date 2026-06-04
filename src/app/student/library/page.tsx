import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Video,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  Calendar,
  BookOpen,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface LibraryItem {
  id: string;
  kind: 'recording' | 'material';
  title: string;
  url: string | null;
  fileType: string | null;
  sessionId: string;
  sessionTitle: string;
  sessionType: string;
  sessionDate: string | null;
  internshipId: string;
  internshipTitle: string;
}

export default async function StudentLibraryPage({
  searchParams,
}: {
  searchParams: { internship?: string; kind?: string };
}) {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  // Get enrolled internships
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id, internships:internship_id (id, title)')
    .eq('student_id', me.userId);

  const internships = (enrollments ?? [])
    .map((e: any) => e.internships)
    .filter(Boolean);

  const internshipIds = internships.map((i: any) => i.id);

  let items: LibraryItem[] = [];

  if (internshipIds.length) {
    // All sessions in enrolled internships
    const { data: sessions } = await supabase
      .from('sessions')
      .select(
        'id, title, session_type, scheduled_at, recording_url, internship_id, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .eq('is_hidden', false)
      .order('scheduled_at', { ascending: false });

    // All materials linked to those sessions
    const sessionIds = (sessions ?? []).map((s: any) => s.id);
    let materials: any[] = [];
    if (sessionIds.length) {
      const { data } = await supabase
        .from('session_materials')
        .select('id, session_id, title, link_url, file_url, file_type, created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });
      materials = data ?? [];
    }

    // Build a session lookup
    const sessionMap = new Map<string, any>(
      (sessions ?? []).map((s: any) => [s.id, s]),
    );

    // 1. Recordings — one per session with a recording_url
    for (const s of sessions ?? []) {
      if (s.recording_url) {
        items.push({
          id: `rec-${s.id}`,
          kind: 'recording',
          title: s.title,
          url: s.recording_url,
          fileType: 'recording',
          sessionId: s.id,
          sessionTitle: s.title,
          sessionType: s.session_type,
          sessionDate: s.scheduled_at,
          internshipId: s.internship_id,
          internshipTitle: (s.internships as any)?.title ?? '—',
        });
      }
    }

    // 2. Materials
    for (const m of materials) {
      const s = sessionMap.get(m.session_id);
      items.push({
        id: m.id,
        kind: 'material',
        title: m.title,
        url: m.link_url ?? m.file_url ?? null,
        fileType: m.file_type ?? null,
        sessionId: m.session_id,
        sessionTitle: s?.title ?? '—',
        sessionType: s?.session_type ?? '',
        sessionDate: s?.scheduled_at ?? m.created_at,
        internshipId: s?.internship_id ?? '',
        internshipTitle: s?.internships?.title ?? '—',
      });
    }

    // Sort everything by sessionDate desc
    items.sort((a, b) => {
      const ad = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
      const bd = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
      return bd - ad;
    });

    // Apply filters
    if (searchParams.internship) {
      items = items.filter((it) => it.internshipId === searchParams.internship);
    }
    if (searchParams.kind === 'recording' || searchParams.kind === 'material') {
      items = items.filter((it) => it.kind === searchParams.kind);
    }
  }

  const recordingCount = items.filter((i) => i.kind === 'recording').length;
  const materialCount = items.filter((i) => i.kind === 'material').length;

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Library"
        subtitle="Every recording and study material from your enrolled internships, in one place."
      />

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Video size={18} />
            </div>
            <div>
              <p className="stat-num" style={{ fontSize: '1.5rem' }}>
                {items.filter((i) => i.kind === 'recording').length}
              </p>
              <p className="stat-label">recordings</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <FileText size={18} />
            </div>
            <div>
              <p className="stat-num" style={{ fontSize: '1.5rem' }}>
                {items.filter((i) => i.kind === 'material').length}
              </p>
              <p className="stat-label">study materials</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <p className="stat-num" style={{ fontSize: '1.5rem' }}>
                {internships.length}
              </p>
              <p className="stat-label">internships</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/student/library"
          className={`pill ${!searchParams.internship && !searchParams.kind ? 'pill-accent' : ''}`}
        >
          All
        </Link>

        {/* Kind filters */}
        <Link
          href={`/student/library?kind=recording${searchParams.internship ? `&internship=${searchParams.internship}` : ''}`}
          className={`pill ${searchParams.kind === 'recording' ? 'pill-accent' : ''}`}
        >
          <Video size={10} className="inline" /> Recordings
        </Link>
        <Link
          href={`/student/library?kind=material${searchParams.internship ? `&internship=${searchParams.internship}` : ''}`}
          className={`pill ${searchParams.kind === 'material' ? 'pill-accent' : ''}`}
        >
          <FileText size={10} className="inline" /> Materials
        </Link>

        <div className="w-full sm:w-auto" style={{ flexBasis: '100%', marginTop: '0.25rem' }}>
          <span className="text-xs mr-2" style={{ color: 'var(--ink-500)' }}>
            Internship:
          </span>
          <Link
            href={`/student/library${searchParams.kind ? `?kind=${searchParams.kind}` : ''}`}
            className={`pill ${!searchParams.internship ? 'pill-accent' : ''}`}
          >
            All
          </Link>
          {internships.map((i: any) => (
            <Link
              key={i.id}
              href={`/student/library?internship=${i.id}${searchParams.kind ? `&kind=${searchParams.kind}` : ''}`}
              className={`pill ml-1 ${searchParams.internship === i.id ? 'pill-accent' : ''}`}
            >
              {i.title}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {items.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Session</th>
                <th>Internship</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.kind === 'recording' ? (
                      <Pill tone="accent">
                        <Video size={10} className="inline" /> recording
                      </Pill>
                    ) : (
                      <Pill tone="blue">
                        {it.url?.startsWith('http') ? (
                          <LinkIcon size={10} className="inline" />
                        ) : (
                          <FileText size={10} className="inline" />
                        )}{' '}
                        {it.fileType ?? 'material'}
                      </Pill>
                    )}
                  </td>
                  <td>
                    <p className="font-medium">{it.title}</p>
                  </td>
                  <td>
                    <Link
                      href={`/student/sessions/${it.sessionId}`}
                      className="link text-sm"
                    >
                      {it.sessionTitle}
                    </Link>
                    <p className="text-xs capitalize" style={{ color: 'var(--ink-500)' }}>
                      {it.sessionType.replace('_', ' ')}
                    </p>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {it.internshipTitle}
                  </td>
                  <td className="text-xs">
                    {it.sessionDate ? formatDate(it.sessionDate) : '—'}
                  </td>
                  <td>
                    {it.url ? (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary text-xs"
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        no link
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Nothing in your library yet"
          hint="Recordings and materials posted by your mentors will appear here."
        />
      )}
    </>
  );
}
