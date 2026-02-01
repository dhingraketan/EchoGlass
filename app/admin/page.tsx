'use client'

import { useEffect, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Todo, Event, CommandLog } from '@/lib/types'
import SetupScreen from '@/components/SetupScreen'

export default function AdminPage() {
  const householdId = process.env.NEXT_PUBLIC_HOUSEHOLD_ID || 'default-household'
  const [activeTab, setActiveTab] = useState<'todos' | 'events' | 'logs'>('todos')
  const [todos, setTodos] = useState<Todo[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [logs, setLogs] = useState<CommandLog[]>([])
  const [showTodoForm, setShowTodoForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'error'>('all')
  const router = useRouter()
  const supabase = createClient()

  // Show setup screen if env vars are missing
  if (!hasSupabaseConfig()) {
    return <SetupScreen />
  }

  useEffect(() => {
    if (activeTab === 'todos') {
      fetchTodos()
    } else if (activeTab === 'events') {
      fetchEvents()
    } else if (activeTab === 'logs') {
      fetchLogs()
    }
  }, [activeTab, filterStatus])

  const fetchTodos = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
    if (data) setTodos(data)
  }

  const fetchEvents = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('household_id', householdId)
      .order('start_at', { ascending: true })
    if (data) setEvents(data)
  }

  const fetchLogs = async () => {
    if (!supabase) return
    let query = supabase
      .from('command_logs')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data } = await query
    if (data) setLogs(data)
  }

  const deleteTodo = async (id: string) => {
    if (!supabase) return
    await supabase.from('todos').delete().eq('id', id)
    fetchTodos()
  }

  const deleteEvent = async (id: string) => {
    if (!supabase) return
    await supabase.from('events').delete().eq('id', id)
    fetchEvents()
  }

  const toggleTodo = async (todo: Todo) => {
    if (!householdId) return
    await supabase
      .from('todos')
      .update({ is_done: !todo.is_done })
      .eq('id', todo.id)
    fetchTodos()
  }


  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Panel</h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'todos' ? 'border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'events' ? 'border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'logs' ? 'border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Command Logs
          </button>
        </div>

        {/* Todos Tab */}
        {activeTab === 'todos' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Todos</h2>
              <button
                onClick={() => setShowTodoForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Add Todo
              </button>
            </div>
            {showTodoForm && (
              <TodoForm
                householdId={householdId}
                onClose={() => {
                  setShowTodoForm(false)
                  fetchTodos()
                }}
              />
            )}
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={todo.is_done}
                      onChange={() => toggleTodo(todo)}
                      className="w-5 h-5"
                    />
                    <span className={todo.is_done ? 'line-through text-gray-500' : ''}>
                      {todo.text}
                    </span>
                    <span className="text-sm text-gray-400">
                      ({todo.source})
                    </span>
                    {todo.due_at && (
                      <span className="text-sm text-gray-400">
                        Due: {new Date(todo.due_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Events</h2>
              <button
                onClick={() => setShowEventForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Add Event
              </button>
            </div>
            {showEventForm && (
              <EventForm
                householdId={householdId}
                onClose={() => {
                  setShowEventForm(false)
                  fetchEvents()
                }}
              />
            )}
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-900 p-4 rounded-lg border border-gray-800"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{event.title}</h3>
                      <p className="text-gray-300">
                        {new Date(event.start_at).toLocaleString()}
                        {event.end_at && ` - ${new Date(event.end_at).toLocaleString()}`}
                      </p>
                      {event.location && (
                        <p className="text-gray-400">📍 {event.location}</p>
                      )}
                      {event.notes && (
                        <p className="text-gray-400 mt-1">{event.notes}</p>
                      )}
                      <span className="text-sm text-gray-500">({event.source})</span>
                    </div>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Command Logs</h2>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              >
                <option value="all">All</option>
                <option value="ok">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`bg-gray-900 p-4 rounded-lg border ${
                    log.status === 'error' ? 'border-red-800' : 'border-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${
                          log.status === 'error' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-300">{log.command_type}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-300">{log.source}</span>
                      </div>
                      {log.message && (
                        <p className="text-gray-300 mb-1">{log.message}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.payload && (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-400 cursor-pointer">
                            View Payload
                          </summary>
                          <pre className="mt-2 p-2 bg-black rounded text-xs overflow-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TodoForm({ householdId, onClose }: { householdId: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [dueAt, setDueAt] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    await supabase.from('todos').insert({
      household_id: householdId,
      text,
      source: 'manual',
      due_at: dueAt || null
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Text</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Due Date (optional)</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

function EventForm({ householdId, onClose }: { householdId: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    await supabase.from('events').insert({
      household_id: householdId,
      title,
      start_at: startAt,
      end_at: endAt || null,
      location: location || null,
      notes: notes || null,
      source: 'manual'
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Start Time</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End Time (optional)</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
