'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { redirect } from 'next/navigation';

export interface ContentConfig {
  sessions: string[];    // session IDs to copy
  assignments: string[]; // assignment IDs to copy
  quizzes: string[];     // quiz IDs to copy
}

export interface ClonePayload {
  sourceId: string;
  title: string;
  description: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;
  totalLevels: number;
  status: string;
  config: ContentConfig;
}

export async function cloneInternship(payload: ClonePayload) {
  const me = await requireRole('admin');
  const supabase = createClient();

  // ── 1. Fetch source internship ─────────────────────────────
  const { data: src } = await supabase
    .from('internships')
    .select('id, title, total_levels, start_date')
    .eq('id', payload.sourceId)
    .single();

  if (!src) throw new Error('Source internship not found');

  const srcStart = src.start_date ? new Date(src.start_date) : new Date();
  const newStart = new Date(payload.startDate);
  const dayOffset = Math.round(
    (newStart.getTime() - srcStart.getTime()) / 86400000
  );

  // ── 2. Create new internship ───────────────────────────────
  const { data: newInt, error: intErr } = await supabase
    .from('internships')
    .insert({
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      total_levels: payload.totalLevels,
      start_date: payload.startDate || null,
      end_date: payload.endDate || null,
      status: payload.status,
      created_by: me.userId,
      template_id: payload.sourceId,
    })
    .select('id')
    .single();

  if (intErr || !newInt) throw new Error(intErr?.message ?? 'Failed to create internship');
  const newId = newInt.id;

  // ── 3. Copy levels ─────────────────────────────────────────
  const { data: srcLevels } = await supabase
    .from('levels')
    .select('*')
    .eq('internship_id', payload.sourceId)
    .order('level_number');

  const levelIdMap = new Map<string, string>(); // old → new

  if (srcLevels?.length) {
    const { data: newLevels } = await supabase
      .from('levels')
      .insert(
        srcLevels.map((l: any) => ({
          internship_id: newId,
          level_number: l.level_number,
          title: l.title,
          pass_threshold: l.pass_threshold,
        }))
      )
      .select('id, level_number');

    // Build old→new level mapping by level_number
    for (const srcL of srcLevels) {
      const newL = newLevels?.find((nl: any) => nl.level_number === srcL.level_number);
      if (newL) levelIdMap.set(srcL.id, newL.id);
    }
  } else {
    // Auto-create levels if source has none
    const levels = Array.from({ length: payload.totalLevels }, (_, i) => ({
      internship_id: newId,
      level_number: i + 1,
      title: `Level ${i + 1}`,
      pass_threshold: 60,
    }));
    await supabase.from('levels').insert(levels);
  }

  // ── 4. Copy selected sessions ──────────────────────────────
  const sessionIdMap = new Map<string, string>(); // old → new

  if (payload.config.sessions.length) {
    const { data: srcSessions } = await supabase
      .from('sessions')
      .select('*')
      .in('id', payload.config.sessions);

    if (srcSessions?.length) {
      const { data: newSessions } = await supabase
        .from('sessions')
        .insert(
          srcSessions.map((s: any) => ({
            internship_id: newId,
            level_id: s.level_id ? levelIdMap.get(s.level_id) ?? null : null,
            title: s.title,
            description: s.description,
            session_type: s.session_type,
            status: 'scheduled',
            recording_url: s.recording_url,
            meeting_url: null,
            scheduled_at: s.scheduled_at
              ? new Date(new Date(s.scheduled_at).getTime() + dayOffset * 86400000).toISOString()
              : null,
            duration_minutes: s.duration_minutes,
            created_by: me.userId,
            cloned_from: s.id,    // ← track provenance for future sync
          }))
        )
        .select('id, title');

      // Map old session IDs → new
      for (let idx = 0; idx < srcSessions.length; idx++) {
        const newS = newSessions?.[idx];
        if (newS) sessionIdMap.set(srcSessions[idx].id, newS.id);
      }

      // Copy session materials for copied sessions
      for (const srcS of srcSessions) {
        const newSid = sessionIdMap.get(srcS.id);
        if (!newSid) continue;
        const { data: mats } = await supabase
          .from('session_materials')
          .select('*')
          .eq('session_id', srcS.id);
        if (mats?.length) {
          await supabase.from('session_materials').insert(
            mats.map((m: any) => ({
              session_id: newSid,
              title: m.title,
              url: m.url,
              material_type: m.material_type,
            }))
          );
        }
      }
    }
  }

  // ── 5. Copy selected assignments ───────────────────────────
  const assignmentIdMap = new Map<string, string>();

  if (payload.config.assignments.length) {
    const { data: srcAssignments } = await supabase
      .from('assignments')
      .select('*')
      .in('id', payload.config.assignments);

    if (srcAssignments?.length) {
      const { data: newAssignments } = await supabase
        .from('assignments')
        .insert(
          srcAssignments.map((a: any) => ({
            internship_id: newId,
            level_id: a.level_id ? levelIdMap.get(a.level_id) ?? null : null,
            title: a.title,
            description: a.description,
            kind: a.kind,
            max_score: a.max_score,
            weight: a.weight,
            allow_github: a.allow_github,
            allow_file_upload: a.allow_file_upload,
            attachment_url: a.attachment_url,
            due_at: a.due_at
              ? new Date(new Date(a.due_at).getTime() + dayOffset * 86400000).toISOString()
              : null,
            created_by: me.userId,
            cloned_from: a.id,    // ← track provenance
          }))
        )
        .select('id');

      for (let idx = 0; idx < srcAssignments.length; idx++) {
        const newA = newAssignments?.[idx];
        if (newA) assignmentIdMap.set(srcAssignments[idx].id, newA.id);
      }
    }
  }

  // ── 6. Copy selected quizzes ───────────────────────────────
  if (payload.config.quizzes.length) {
    const { data: srcQuizzes } = await supabase
      .from('quizzes')
      .select('*, quiz_questions (*)')
      .in('id', payload.config.quizzes);

    for (const q of srcQuizzes ?? []) {
      const newSid = sessionIdMap.get(q.session_id);
      if (!newSid) continue; // only copy if the session was also copied

      const { data: newQuiz } = await supabase
        .from('quizzes')
        .insert({
          session_id: newSid,
          title: q.title,
          status: 'draft',
          mode: q.mode ?? 'live',
          starts_at: q.starts_at
            ? new Date(new Date(q.starts_at).getTime() + dayOffset * 86400000).toISOString()
            : null,
          ends_at: q.ends_at
            ? new Date(new Date(q.ends_at).getTime() + dayOffset * 86400000).toISOString()
            : null,
          created_by: me.userId,
          cloned_from: q.id,    // ← track provenance
        })
        .select('id')
        .single();

      if (newQuiz && q.quiz_questions?.length) {
        await supabase.from('quiz_questions').insert(
          q.quiz_questions.map((qq: any) => ({
            quiz_id: newQuiz.id,
            question_text: qq.question_text,
            option_a: qq.option_a,
            option_b: qq.option_b,
            option_c: qq.option_c,
            option_d: qq.option_d,
            correct_option: qq.correct_option,
            explanation: qq.explanation,
          }))
        );
      }
    }
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'internship.clone',
    entity_type: 'internship',
    entity_id: newId,
    details: {
      source: payload.sourceId,
      title: payload.title,
      sessions_copied: payload.config.sessions.length,
      assignments_copied: payload.config.assignments.length,
      quizzes_copied: payload.config.quizzes.length,
    },
  });

  redirect(`/admin/internships/${newId}`);
}
