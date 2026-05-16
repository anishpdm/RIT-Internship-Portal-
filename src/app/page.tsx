import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Layers,
  Trophy,
  Code2,
} from 'lucide-react';

export default async function HomePage() {
  const me = await getCurrentUser();
  if (me) redirect(`/${me.profile.role}`);

  return (
    <main className="min-h-screen surface-gradient">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="brand-mark">RIT</span>
            <div>
              <p className="font-display text-base font-semibold leading-tight">
                Internship Portal
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                Rajiv Gandhi Institute of Technology
              </p>
            </div>
          </div>
          <Link href="/login" className="btn btn-primary">
            Sign in <ArrowRight size={14} />
          </Link>
        </header>

        {/* Hero */}
        <section className="mt-20 md:mt-28 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Sparkles size={12} /> Built for cohort-based learning
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Internship management,<br />
            <span style={{ color: 'var(--accent)' }}>done properly.</span>
          </h1>
          <p className="mt-6 text-lg max-w-2xl" style={{ color: 'var(--ink-500)' }}>
            Multi-level cohorts, rotating attendance codes for live sessions,
            heartbeat-verified watching for recorded ones, GitHub-or-file
            submissions, and an audit trail on everything that matters.
          </p>
          <div className="mt-10 flex gap-3 flex-wrap">
            <Link href="/login" className="btn btn-primary">
              Open your portal <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mt-32 grid md:grid-cols-3 gap-5">
          {[
            {
              icon: ShieldCheck,
              eyebrow: 'For administrators',
              title: 'Run the whole cohort',
              body: 'Internships, levels, mentors, students, sessions, assignments — and a full audit trail of every action.',
            },
            {
              icon: GraduationCap,
              eyebrow: 'For mentors',
              title: 'Teach and evaluate',
              body: 'Add students, schedule sessions, post assignments, grade submissions — all scoped to your internships.',
            },
            {
              icon: Code2,
              eyebrow: 'For students',
              title: 'Submit and progress',
              body: 'Verified attendance, GitHub or file submissions, real-time scores, level progression visible at a glance.',
            },
          ].map((b) => (
            <div key={b.title} className="card card-hover">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <b.icon size={20} />
              </div>
              <p className="eyebrow">{b.eyebrow}</p>
              <h3 className="font-display text-xl font-semibold mt-1">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-500)' }}>
                {b.body}
              </p>
            </div>
          ))}
        </section>

        {/* Capability strip */}
        <section className="mt-20 card card-hover">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Layers, label: 'Multi-level progression', body: 'Promote, retain, or filter students per level with weighted scoring.' },
              { icon: Trophy, label: 'Cohort leaderboards', body: 'Live rankings per internship, calculated from graded submissions.' },
              { icon: ShieldCheck, label: 'Anti-bypass attendance', body: 'Rotating codes, video heartbeats, dwell-time tracking with reflections.' },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon size={16} style={{ color: 'var(--accent)' }} />
                  <p className="font-display font-semibold">{c.label}</p>
                </div>
                <p className="text-sm" style={{ color: 'var(--ink-500)' }}>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-32 pt-8 pb-12 text-center" style={{ borderTop: '1px solid var(--ink-200)', color: 'var(--ink-500)', fontSize: '0.85rem' }}>
          Rajiv Gandhi Institute of Technology, Kottayam · Internship Portal
        </footer>
      </div>
    </main>
  );
}
