-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE source_type AS ENUM ('manual', 'alexa');
CREATE TYPE command_status AS ENUM ('ok', 'error');

-- Todos table
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source source_type DEFAULT 'manual',
  due_at TIMESTAMPTZ,
  household_id UUID NOT NULL
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  source source_type DEFAULT 'manual',
  household_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command logs table
CREATE TABLE command_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source source_type NOT NULL,
  command_type TEXT NOT NULL,
  payload JSONB,
  status command_status NOT NULL,
  message TEXT,
  household_id UUID NOT NULL
);

-- Create indexes
CREATE INDEX idx_todos_household_id ON todos(household_id);
CREATE INDEX idx_todos_due_at ON todos(due_at);
CREATE INDEX idx_events_household_id ON events(household_id);
CREATE INDEX idx_events_start_at ON events(start_at);
CREATE INDEX idx_command_logs_household_id ON command_logs(household_id);
CREATE INDEX idx_command_logs_created_at ON command_logs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for MVP - adjust for production)
-- Allow all operations for authenticated users (you can refine this later)
CREATE POLICY "Allow all for authenticated users" ON todos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON command_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
