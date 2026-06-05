import { createClient } from '@/lib/supabase/server';

/**
 * Returns the level IDs accessible to a student.
 * A student at Level 2 can access content from Level 1 AND Level 2.
 * Content with level_id = NULL is accessible at all levels.
 *
 * Usage in queries:
 *   .or(`level_id.is.null,level_id.in.(${levelIds.join(',')})`)
 *
 * Returns null if the student has no enrollments (show nothing).
 */
export async function getAccessibleLevelIds(userId: string): Promise<{
  levelIds: string[];
  enrollments: Array<{ internship_id: string; current_level: number }>;
} | null> {
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id, current_level')
    .eq('student_id', userId);

  if (!enrollments?.length) return null;

  // For each enrollment, find all level IDs from level 1 up to current_level
  const levelIdResults = await Promise.all(
    enrollments.map((e: any) =>
      supabase
        .from('levels')
        .select('id')
        .eq('internship_id', e.internship_id)
        .lte('level_number', e.current_level)
    )
  );

  const levelIds = levelIdResults
    .flatMap((r) => (r.data ?? []).map((l: any) => l.id))
    .filter(Boolean);

  return {
    levelIds,
    enrollments: enrollments as Array<{ internship_id: string; current_level: number }>,
  };
}

/**
 * Builds a Supabase `.or()` filter string for level-gated content.
 * Content with no level_id is always accessible.
 * Content with a level_id is accessible if it's in the student's accessible levels.
 */
export function levelOrFilter(levelIds: string[]): string {
  if (!levelIds.length) return 'level_id.is.null';
  return `level_id.is.null,level_id.in.(${levelIds.join(',')})`;
}
