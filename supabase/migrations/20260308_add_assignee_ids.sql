-- Add assignee_ids array column to tasks and designs tables
-- This enables multi-select assignees in the UI
-- The legacy assignee_id column is preserved for backward compatibility

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] DEFAULT '{}';

ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] DEFAULT '{}';

-- Seed assignee_ids from existing assignee_id where set
UPDATE tasks
  SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');

UPDATE designs
  SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}');
