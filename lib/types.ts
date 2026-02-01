export type SourceType = 'manual' | 'alexa'
export type CommandStatus = 'ok' | 'error'

export interface Todo {
  id: string
  text: string
  is_done: boolean
  created_at: string
  updated_at: string
  source: SourceType
  due_at: string | null
  household_id: string
}

export interface Event {
  id: string
  title: string
  start_at: string
  end_at: string | null
  location: string | null
  notes: string | null
  source: SourceType
  household_id: string
  created_at: string
  updated_at: string
}

export interface CommandLog {
  id: string
  created_at: string
  source: SourceType
  command_type: string
  payload: any
  status: CommandStatus
  message: string | null
  household_id: string
}
