-- Create closet table for storing items the user decides to purchase
CREATE TABLE IF NOT EXISTS public.closet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  clothing_url TEXT,
  clothing_image_url TEXT NOT NULL,
  tryout_result_image_url TEXT,
  tryout_command_id UUID REFERENCES photo_tryout_commands(id),
  notes TEXT
);

-- Enable Realtime for closet table
ALTER PUBLICATION supabase_realtime ADD TABLE closet;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_closet_created_at ON closet(created_at DESC);

-- Disable RLS for simplicity (or create policies if needed)
ALTER TABLE closet DISABLE ROW LEVEL SECURITY;
