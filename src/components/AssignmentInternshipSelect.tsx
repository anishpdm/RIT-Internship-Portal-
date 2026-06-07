'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface Internship { id: string; title: string; }
interface Level      { id: string; level_number: number; title: string | null; internship_id: string; }
interface Session    { id: string; title: string; level_id: string | null; scheduled_at: string | null; session_type: string; }

interface Props {
  internships: Internship[];
  levelsByInternship: Record<string, Level[]>;
  sessionsByInternship: Record<string, Session[]>;
}

export default function AssignmentInternshipSelect({
  internships, levelsByInternship, sessionsByInternship,
}: Props) {
  const [internshipId, setInternshipId]   = useState('');
  const [sessionId,    setSessionId]      = useState('');
  const [levelId,      setLevelId]        = useState('');

  const levels   = internshipId ? (levelsByInternship[internshipId]   ?? []) : [];
  const sessions = internshipId ? (sessionsByInternship[internshipId] ?? []) : [];

  // When a session is selected, auto-fill the level from that session
  function handleSessionChange(sid: string) {
    setSessionId(sid);
    if (!sid) return;
    const sess = sessions.find(s => s.id === sid);
    if (sess?.level_id) setLevelId(sess.level_id);
    else setLevelId('');          // session has no level — clear
  }

  // When internship changes, reset session + level
  function handleInternshipChange(iid: string) {
    setInternshipId(iid);
    setSessionId('');
    setLevelId('');
  }

  function fmtDate(d: string | null) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Internship */}
      <div>
        <label className="field-label">
          Internship <span style={{ color: 'var(--red-500)' }}>*</span>
        </label>
        <select
          name="internship_id"
          className="field"
          required
          value={internshipId}
          onChange={e => handleInternshipChange(e.target.value)}
        >
          <option value="">— Choose internship —</option>
          {internships.map(i => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Session (optional) + Level (optional) — appear once internship selected */}
      {internshipId && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl p-4"
          style={{ background: 'var(--ink-50)', border: '1.5px solid var(--ink-200)' }}>

          {/* Session selector */}
          <div>
            <label className="field-label">
              Link to session
              <span className="ml-1 font-normal" style={{ color: 'var(--ink-500)' }}>
                — optional, auto-fills level
              </span>
            </label>
            <select
              name="linked_session_id"
              className="field"
              value={sessionId}
              onChange={e => handleSessionChange(e.target.value)}
            >
              <option value="">— No session —</option>
              {sessions.length === 0 && (
                <option disabled>No sessions in this internship yet</option>
              )}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title}
                  {s.scheduled_at ? ` · ${fmtDate(s.scheduled_at)}` : ''}
                  {s.session_type !== 'live' ? ` · ${s.session_type}` : ''}
                </option>
              ))}
            </select>
            {sessionId && (() => {
              const s = sessions.find(x => x.id === sessionId);
              return s?.level_id ? (
                <p className="text-xs mt-1" style={{ color: 'var(--green-700)' }}>
                  ✓ Level auto-filled from session
                </p>
              ) : s ? (
                <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                  This session has no level — set level manually below
                </p>
              ) : null;
            })()}
          </div>

          {/* Level selector */}
          <div>
            <label className="field-label">
              Level
              <span className="ml-1 font-normal" style={{ color: 'var(--ink-500)' }}>
                — optional
              </span>
            </label>
            <select
              name="level_id"
              className="field"
              value={levelId}
              onChange={e => setLevelId(e.target.value)}
            >
              <option value="">— All students (no level) —</option>
              {levels.length === 0 && (
                <option disabled>No levels defined for this internship</option>
              )}
              {levels.map(l => (
                <option key={l.id} value={l.id}>
                  Level {l.level_number}{l.title ? ` — ${l.title}` : ''}
                </option>
              ))}
            </select>
            {levelId && (
              <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                Only students who reached this level will see this assignment
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hint when nothing selected */}
      {!internshipId && (
        <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
          Select an internship to choose a session and level
        </p>
      )}
    </div>
  );
}
