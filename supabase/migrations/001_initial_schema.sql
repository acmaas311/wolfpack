-- ═══════════════════════════════════════════════════
-- WOLFPACK COMMAND CENTER — Database Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ─── Enable storage for design images ───
-- (Storage bucket created via Supabase dashboard)

-- ─── Team members (linked to auth.users via Google OAuth) ───
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94A3B8',
  initials TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the 4 partners (auth_id linked after first Google sign-in)
INSERT INTO public.team_members (name, role, color, initials, email) VALUES
  ('Will Edwards', 'Creative Lead', '#FF6B35', 'WE', null),
  ('Andrew Maas', 'Operations Lead', '#1D428A', 'AM', null),
  ('Sam Marks', 'Growth & Analytics', '#2D9E6B', 'SM', null),
  ('Garret Starr', 'Finance & Strategy', '#7C5CBF', 'GS', null);

-- ─── Designs ───
CREATE TABLE public.designs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'concept'
    CHECK (status IN ('concept', 'in-review', 'approved', 'listed')),
  assignee_id UUID REFERENCES public.team_members(id),
  notes TEXT DEFAULT '',
  image_path TEXT, -- path in Supabase Storage
  platforms TEXT[] DEFAULT '{}',
  sales INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Tasks ───
CREATE TABLE public.tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in-progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT NOT NULL DEFAULT 'operations'
    CHECK (category IN ('design', 'operations', 'marketing', 'finance')),
  assignee_id UUID REFERENCES public.team_members(id),
  design_id BIGINT REFERENCES public.designs(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Decisions ───
CREATE TABLE public.decisions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vote_type TEXT NOT NULL DEFAULT 'unanimous'
    CHECK (vote_type IN ('unanimous', 'majority', 'role-owner')),
  result TEXT NOT NULL DEFAULT 'Pending'
    CHECK (result IN ('Approved', 'Rejected', 'Tabled', 'Pending')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial decisions from kickoff meeting
INSERT INTO public.decisions (title, decision_date, vote_type, result) VALUES
  ('LLC State: Colorado', '2026-03-01', 'unanimous', 'Approved'),
  ('Initial capital: $500 each', '2026-03-01', 'unanimous', 'Approved'),
  ('Ownership: 25% each, 4yr vesting', '2026-03-01', 'unanimous', 'Approved'),
  ('Base pricing: $27.99', '2026-03-01', 'majority', 'Approved');

-- ─── Activity log (for Slack notifications) ───
CREATE TABLE public.activity_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES public.team_members(id),
  action TEXT NOT NULL, -- 'task_created', 'task_moved', 'design_updated', 'decision_made', 'sale'
  entity_type TEXT NOT NULL, -- 'task', 'design', 'decision', 'sale'
  entity_id BIGINT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Auto-update updated_at timestamps ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER designs_updated_at
  BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated team members can read/write everything
-- (Access is restricted at the auth layer — only approved Google accounts can sign in)
CREATE POLICY "Team members can read all" ON public.team_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team members can update own profile" ON public.team_members
  FOR UPDATE TO authenticated USING (auth_id = auth.uid());

CREATE POLICY "Authenticated can read tasks" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read designs" ON public.designs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read decisions" ON public.decisions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read activity" ON public.activity_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes for performance ───
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);
CREATE INDEX idx_tasks_design ON public.tasks(design_id);
CREATE INDEX idx_designs_status ON public.designs(status);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

-- ─── Supabase Storage bucket (run in dashboard or via API) ───
-- Create a bucket called 'design-images' with public access
-- Settings: Public bucket, 5MB file size limit, allowed MIME types: image/*
