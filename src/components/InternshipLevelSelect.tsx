'use client';

import { useState, useEffect } from 'react';

interface Level { id: string; level_number: number; title: string | null; }
interface Internship { id: string; title: string; }

interface Props {
  internships: Internship[];
  // Pre-loaded levels grouped by internship_id
  levelsByInternship: Record<string, Level[]>;
  defaultInternshipId?: string;
  defaultLevelId?: string;
}

export default function InternshipLevelSelect({
  internships, levelsByInternship, defaultInternshipId = '', defaultLevelId = '',
}: Props) {
  const [selectedInternship, setSelectedInternship] = useState(defaultInternshipId);
  const levels = selectedInternship ? (levelsByInternship[selectedInternship] ?? []) : [];

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="field-label">Internship <span style={{ color: 'var(--red-500)' }}>*</span></label>
        <select
          name="internship_id"
          className="field"
          required
          value={selectedInternship}
          onChange={e => setSelectedInternship(e.target.value)}
        >
          <option value="">— Choose internship —</option>
          {internships.map(i => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Level (optional)</label>
        <select name="level_id" className="field" defaultValue={defaultLevelId} key={selectedInternship}>
          <option value="">— No level / all students —</option>
          {levels.map(l => (
            <option key={l.id} value={l.id}>
              Level {l.level_number}{l.title ? ` — ${l.title}` : ''}
            </option>
          ))}
        </select>
        {selectedInternship && levels.length === 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            No levels defined for this internship yet.
          </p>
        )}
        {!selectedInternship && (
          <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
            Select an internship first
          </p>
        )}
      </div>
    </div>
  );
}
