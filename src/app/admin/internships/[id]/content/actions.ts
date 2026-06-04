'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ALLOWED_TABLES = ['sessions', 'assignments', 'quizzes'] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

export async function toggleVisibility({
  id,
  table,
  hidden,
}: {
  id: string;
  table: string;
  hidden: boolean;
}) {
  await requireRole('admin');
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    throw new Error('Invalid table');
  }
  const supabase = createAdminClient();
  await supabase.from(table as AllowedTable).update({ is_hidden: hidden }).eq('id', id);
  revalidatePath('/admin/internships', 'layout');
}

export async function bulkToggle({
  ids,
  table,
  hidden,
}: {
  ids: string[];
  table: string;
  hidden: boolean;
}) {
  await requireRole('admin');
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    throw new Error('Invalid table');
  }
  if (!ids.length) return;
  const supabase = createAdminClient();
  await supabase.from(table as AllowedTable).update({ is_hidden: hidden }).in('id', ids);
  revalidatePath('/admin/internships', 'layout');
}
