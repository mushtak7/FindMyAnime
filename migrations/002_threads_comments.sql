-- Migration 002: Add threads, comments tables and review score breakdown
-- Run with: psql $DATABASE_URL -f migrations/002_threads_comments.sql

-- Threads table for episode-specific discussions
CREATE TABLE IF NOT EXISTS threads (
  id SERIAL PRIMARY KEY,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER DEFAULT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_anime ON threads(anime_id);

-- Comments table with nesting (depth limit 2)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE DEFAULT NULL,
  content TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  status VARCHAR(10) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);

-- Add detailed score breakdown to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS story_score INTEGER DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS animation_score INTEGER DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sound_score INTEGER DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS character_score INTEGER DEFAULT NULL;
