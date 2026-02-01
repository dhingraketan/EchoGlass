-- Create photo_tryout_commands table for photo tryout feature
CREATE TABLE IF NOT EXISTS public.photo_tryout_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'waiting_photo', 'processing', 'completed', 'failed')),
  tryout_type TEXT NOT NULL CHECK (tryout_type IN ('photo', 'video')),
  clothing_url TEXT,
  clothing_image_url TEXT,
  user_photo_url TEXT,
  result_image_url TEXT,
  error_message TEXT
);

-- Enable Realtime for photo_tryout_commands table
ALTER PUBLICATION supabase_realtime ADD TABLE photo_tryout_commands;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_photo_tryout_commands_status ON photo_tryout_commands(status);
CREATE INDEX IF NOT EXISTS idx_photo_tryout_commands_created_at ON photo_tryout_commands(created_at DESC);

-- Disable RLS for simplicity (or create policies if needed)
ALTER TABLE photo_tryout_commands DISABLE ROW LEVEL SECURITY;
