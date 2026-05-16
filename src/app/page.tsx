import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const me = await getCurrentUser();
  if (me) redirect(`/${me.profile.role}`);

  return (
    <main className="min-h-screen paper">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 bg-ink-900 text-white font-display font-semibold flex items-center justify-center"
              style={{ background: 'var(--ink-900)', color: 'white' }}
            >
              F
            </div>
            <span className="font-display text-xl font-semibold">ForgeML</span>
          </div>
          <Link href="/login" className="btn btn-secondary">
            Sign in
          </Link>
        </header>

        <section className="mt-24 md:mt-32 max-w-3xl">
          <p className="eyebrow">Internship Platform · v1.0</p>
          <h1 className="page-title mt-3 text-5xl md:text-7xl leading-[1.02]">
            Run a serious training program
            <span className="italic" style={{ color: 'var(--accent)' }}>
              {' '}without the bypass loopholes.
            </span>
          </h1>
          <p className="mt-6 text-lg" style={{ color: 'var(--ink-500)' }}>
            Multi-level cohorts, rotating attendance codes for live sessions,
            active-tab heartbeats for recorded ones, GitHub-or-file submissions,
            audit logs on everything. Built for cohort programs like the 45-Day
            AI/ML curriculum, generalised for any.
          </p>
          <div className="mt-10 flex gap-3 flex-wrap">
            <Link href="/login" className="btn btn-primary">
              Sign in to your portal →
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              Read the docs
            </a>
          </div>
        </section>

        <section className="mt-28 md:mt-40 grid md:grid-cols-3 gap-px bg-ink-100" style={{ background: 'var(--ink-100)' }}>
          {[
            {
              eyebrow: 'For admins',
              title: 'Wire the entire cohort',
              body: 'Internships, levels, students, mentors, sessions, assignments — and a full audit trail of every change.',
            },
            {
              eyebrow: 'For mentors',
              title: 'Teach and evaluate',
              body: 'See only the internships you own. Schedule sessions, upload materials, grade submissions, sort students by level.',
            },
            {
              eyebrow: 'For students',
              title: 'Submit and progress',
              body: 'GitHub link or file upload. Watch sessions with verified attendance. Track your score and level in one place.',
            },
          ].map((b) => (
            <div key={b.title} className="paper p-8" style={{ background: 'var(--paper)' }}>
              <p className="eyebrow">{b.eyebrow}</p>
              <h3 className="font-display text-2xl font-semibold mt-2">
                {b.title}
              </h3>
              <p className="mt-3 text-sm" style={{ color: 'var(--ink-500)' }}>
                {b.body}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-32 pt-8" style={{ borderTop: '1px solid var(--ink-100)', color: 'var(--ink-500)', fontSize: '0.875rem' }}>
          Built with Next.js, Supabase, and Tailwind. Free to host on Vercel.
        </footer>
      </div>
    </main>
  );
}
