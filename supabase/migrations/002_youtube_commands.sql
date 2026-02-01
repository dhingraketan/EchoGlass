-- Create youtube_commands table for YouTube playback feature
CREATE TABLE IF NOT EXISTS public.youtube_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  youtube_url TEXT
);

-- Enable Realtime for youtube_commands table
ALTER PUBLICATION supabase_realtime ADD TABLE youtube_commands;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_youtube_commands_status ON youtube_commands(status);
CREATE INDEX IF NOT EXISTS idx_youtube_commands_created_at ON youtube_commands(created_at DESC);

-- Disable RLS for simplicity (or create policies if needed)
ALTER TABLE youtube_commands DISABLE ROW LEVEL SECURITY;
