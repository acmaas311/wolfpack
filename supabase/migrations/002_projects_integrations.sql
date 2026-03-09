-- ═══════════════════════════════════════════════════
-- WOLFPACK COMMAND CENTER — Migration 002
-- Projects, Drive attachments, Canva links
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ─── Projects ───
CREATE TABLE public.projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'complete')),
  due_date DATE,
  client TEXT DEFAULT '',
  budget NUMERIC(12,2),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  lead_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  drive_file_url TEXT,
  drive_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at for projects
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can CRUD projects" ON public.projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_lead ON public.projects(lead_id);
CREATE INDEX idx_projects_due ON public.projects(due_date);

-- ─── Add project linkage + Drive file fields to tasks ───
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drive_file_url TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_name TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);

-- ─── Add Canva fields to designs ───
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS canva_design_url TEXT,
  ADD COLUMN IF NOT EXISTS canva_design_name TEXT;
