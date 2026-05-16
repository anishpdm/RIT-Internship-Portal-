export type UserRole = 'admin' | 'mentor' | 'student';
export type InternshipStatus = 'draft' | 'active' | 'completed' | 'archived';
export type EnrollmentStatus =
  | 'active'
  | 'promoted'
  | 'filtered'
  | 'completed'
  | 'dropped';
export type SessionType = 'live' | 'recorded' | 'self_learning';
export type SessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type AttendanceStatus = 'present' | 'partial' | 'absent';
export type AssignmentKind =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'assessment'
  | 'milestone';
export type SubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'graded'
  | 'returned';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Internship {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  total_levels: number;
  start_date: string | null;
  end_date: string | null;
  status: InternshipStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Level {
  id: string;
  internship_id: string;
  level_number: number;
  title: string;
  description: string | null;
  pass_threshold: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  internship_id: string;
  student_id: string;
  current_level: number;
  status: EnrollmentStatus;
  total_score: number;
  enrolled_at: string;
  promoted_at: string | null;
  filtered_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface SessionRow {
  id: string;
  internship_id: string;
  level_id: string | null;
  title: string;
  description: string | null;
  session_type: SessionType;
  status: SessionStatus;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  video_duration_sec: number | null;
  min_dwell_minutes: number | null;
  required_for_progression: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SessionMaterial {
  id: string;
  session_id: string;
  title: string;
  link_url: string | null;
  file_url: string | null;
  file_type: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string | null;
  active_seconds: number;
  last_heartbeat: string | null;
  last_position: number | null;
  code_used: string | null;
  reflection_note: string | null;
}

export interface Assignment {
  id: string;
  internship_id: string;
  level_id: string | null;
  title: string;
  description: string | null;
  kind: AssignmentKind;
  max_score: number;
  due_at: string | null;
  allow_github: boolean;
  allow_file_upload: boolean;
  attachment_url: string | null;
  weight: number;
  created_by: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  github_url: string | null;
  file_url: string | null;
  notes: string | null;
  submitted_at: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  evaluated_by: string | null;
  evaluated_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
