-- ═══════════════════════════════════════════════════
-- WOLFPACK COMMAND CENTER — Migration 20260309
-- Add all missing columns to the designs table
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Multi-assignee support (array of UUIDs)
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] DEFAULT '{}';

-- Who submitted/created this design (for tracking)
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Google Drive file attachment
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS drive_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_name TEXT;

-- Canva integration (added in migration 002 — included here for safety)
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS canva_design_url  TEXT,
  ADD COLUMN IF NOT EXISTS canva_design_name TEXT;

-- Backfill assignee_ids from legacy single assignee_id
UPDATE public.designs
  SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL
    AND (assignee_ids IS NULL OR assignee_ids = '{}');
