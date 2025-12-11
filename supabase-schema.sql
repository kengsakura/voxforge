-- VoxForge Database Schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Table: presets
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
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
  device_id TEXT PRIMARY KEY,
  chunk_size INTEGER NOT NULL DEFAULT 3000,
  merge_output BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_presets_device_id ON presets(device_id);

-- Enable Row Level Security (RLS)
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for anonymous users (using device_id)
-- Note: This is a simple setup. For production with auth, use auth.uid() instead.

-- Presets policies
CREATE POLICY "Allow all for presets" ON presets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- User settings policies  
CREATE POLICY "Allow all for user_settings" ON user_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
