-- =====================================================================
-- ForgeML — Seed data
-- Optional: creates a sample internship matching the 45-Day AI/ML plan.
-- Run AFTER you have created at least one admin user.
-- =====================================================================

-- Get the first admin (used as created_by)
do $$
declare
  v_admin uuid;
  v_internship uuid;
  v_level1 uuid;
  v_level2 uuid;
  v_level3 uuid;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise notice 'No admin user found. Create one first, then re-run.';
    return;
  end if;

  -- Internship
  insert into public.internships (title, slug, description, total_levels, start_date, end_date, status, created_by)
  values (
    '45-Day AI/ML Practical Training Program',
    '45-day-aiml',
    'Hands-on AI/ML curriculum for Mechanical Engineering students. Classical ML → Deep Learning → Deployable applications. Manual computation first, modern libraries second.',
    3,
    current_date,
    current_date + interval '45 days',
    'active',
    v_admin
  )
  returning id into v_internship;

  -- Levels
  insert into public.levels (internship_id, level_number, title, description, pass_threshold)
  values
    (v_internship, 1, 'ML Foundations', 'Classical ML — manual computation, matrix form, sklearn, evaluation, full pipeline.', 60.0)
  returning id into v_level1;

  insert into public.levels (internship_id, level_number, title, description, pass_threshold)
  values
    (v_internship, 2, 'Deep Learning & CNNs', 'Neural networks from scratch, PyTorch, CNNs, image classification.', 70.0)
  returning id into v_level2;

  insert into public.levels (internship_id, level_number, title, description, pass_threshold)
  values
    (v_internship, 3, 'Practical Applications & Deployment', 'Object detection, deployment, mentored capstone projects.', 75.0)
  returning id into v_level3;

  -- A few sample sessions (Level 1)
  insert into public.sessions (internship_id, level_id, title, description, session_type, scheduled_at, duration_minutes, meeting_url, created_by)
  values
    (v_internship, v_level1, 'What is ML + Linear Regression by Hand', 'ML vs traditional programming; supervised/unsupervised; univariate LR derivation on a 5-point dataset.', 'live', now() + interval '1 day', 90, 'https://meet.google.com/example', v_admin),
    (v_internship, v_level1, 'Linear Regression — Matrix Form & Normal Equation', 'Derive θ = (XᵀX)⁻¹Xᵀy. Implement on multi-feature housing dataset.', 'live', now() + interval '3 days', 90, 'https://meet.google.com/example', v_admin),
    (v_internship, v_level1, 'Cost Function & Gradient Descent', 'MSE cost surface, partial derivatives, batch GD vs stochastic.', 'live', now() + interval '5 days', 90, 'https://meet.google.com/example', v_admin);

  -- A few sample assignments (Level 1)
  insert into public.assignments (internship_id, level_id, title, description, kind, max_score, due_at, allow_github, allow_file_upload, created_by)
  values
    (v_internship, v_level1, 'LR by Hand + Pure Python', 'Given 8 (x, y) points: compute m, c manually on paper (photo upload). Implement same in Python without NumPy/sklearn. Predict for 3 unseen x. Submit notebook + paper photo.', 'weekly', 100, now() + interval '2 days', true, true, v_admin),
    (v_internship, v_level1, 'Multi-Feature Normal Equation', 'Use a small housing dataset (5 features). Implement normal equation from scratch with NumPy. Verify against sklearn — coefficients must match to 4 decimals.', 'weekly', 100, now() + interval '4 days', true, true, v_admin),
    (v_internship, v_level1, 'Milestone 1 — Tabular ML Capstone', '72-hour assessment on a real-world tabular dataset. EDA, preprocessing, 3 models compared, final model justified. GitHub repo + 2-page PDF report.', 'milestone', 100, now() + interval '15 days', true, true, v_admin);

  raise notice 'Seed complete. Internship ID: %', v_internship;
end $$;
