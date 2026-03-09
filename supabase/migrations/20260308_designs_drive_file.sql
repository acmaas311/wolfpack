-- Add Google Drive file attachment fields to designs table
-- Replaces the canva_design_url/name fields in the UI (columns kept for backward compat)

ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS drive_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_name TEXT;
