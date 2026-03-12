-- Migration 001: Add status, episodes_watched, and score to watchlists table
-- Run with: psql $DATABASE_URL -f migrations/001_watchlist_status.sql

ALTER TABLE watchlists
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'plan_to_watch',
  ADD COLUMN IF NOT EXISTS episodes_watched INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL;

-- Add check constraint for valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'watchlists_status_check'
  ) THEN
    ALTER TABLE watchlists
      ADD CONSTRAINT watchlists_status_check
      CHECK (status IN ('plan_to_watch', 'watching', 'completed', 'dropped', 'on_hold'));
  END IF;
END $$;

-- Add check constraint for valid scores (1-10, matching MAL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'watchlists_score_check'
  ) THEN
    ALTER TABLE watchlists
      ADD CONSTRAINT watchlists_score_check
      CHECK (score IS NULL OR (score >= 1 AND score <= 10));
  END IF;
END $$;
