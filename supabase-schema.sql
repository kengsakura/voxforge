-- VoxForge Database Schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Drop existing tables if you want to start fresh (optional)
-- DROP TABLE IF EXISTS presets;
-- DROP TABLE IF EXISTS user_settings;

-- Table: presets
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT,
  speed TEXT NOT NULL DEFAULT 'Normal',
  temperature REAL NOT NULL DEFAULT 0.7,
  voice TEXT NOT NULL DEFAULT 'Kore',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-preview-tts',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_size INTEGER NOT NULL DEFAULT 3000,
  merge_output BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_presets_user_id ON presets(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- Presets policies
DROP POLICY IF EXISTS "Users can view own presets" ON presets;
CREATE POLICY "Users can view own presets" ON presets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own presets" ON presets;
CREATE POLICY "Users can insert own presets" ON presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presets" ON presets;
CREATE POLICY "Users can update own presets" ON presets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own presets" ON presets;
CREATE POLICY "Users can delete own presets" ON presets
  FOR DELETE USING (auth.uid() = user_id);

-- User settings policies
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);
