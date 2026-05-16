import { createAdminClient } from './supabase/server';
import type { UserRole } from './types';

export interface AuditEntry {
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
}

/**
 * Write an audit-log row. Always uses the service-role client so that
 * the row is written even if RLS would otherwise block it.
 */
export async function logAudit(entry: AuditEntry) {
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? {},
      ip_address: entry.ip_address ?? null,
    });
  } catch (err) {
    // Never block the user-facing action on a log failure
    console.error('Audit log write failed', err);
  }
}
