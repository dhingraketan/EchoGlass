'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Todo {
  id: number
  created_at: string
  body: string | null
  completed: boolean | null
}

export default function TodoWidget({ householdId }: { householdId: string }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    const fetchTodos = async () => {
      const { data, error } = await supabase
        .from('todo')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(7)

      if (error) {
        console.error('Error fetching todos:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        // Check if table doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('404') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('todo table not found - make sure the table exists in Supabase')
        }
        // Check if RLS is blocking access
        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('RLS')) {
          console.error('RLS (Row Level Security) is blocking access. You need to either:')
          console.error('1. Disable RLS on the todo table, OR')
          console.error('2. Create a policy: ALTER TABLE todo ENABLE ROW LEVEL SECURITY;')
          console.error('   CREATE POLICY "Allow public read" ON todo FOR SELECT USING (true);')
          console.error('   CREATE POLICY "Allow public update" ON todo FOR UPDATE USING (true);')
        }
        setTodos([])
      } else if (data) {
        // Show open todos first, then completed
        const sorted = [...data].sort((a, b) => {
          const aCompleted = a.completed ?? false
          const bCompleted = b.completed ?? false
          if (aCompleted === bCompleted) return 0
          return aCompleted ? 1 : -1
        })
        setTodos(sorted)
        console.log('Fetched todos:', sorted.length)
      } else {
        setTodos([])
      }
      setLoading(false)
    }

    fetchTodos()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('todo-changes', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo'
        },
        (payload: any) => {
          console.log('Todo real-time event received:', payload)
          fetchTodos()
        }
      )
      .subscribe((status: string) => {
        console.log('Todo subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to todo changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Todo subscription error - check if Realtime is enabled for todo table')
        }
      })

    return () => {
      console.log('Cleaning up todo subscription')
      supabase.removeChannel(channel)
    }
  }, [])

  const toggleTodo = async (todoId: number, currentStatus: boolean | null) => {
    const supabase = createClient()
    if (!supabase) return
    await supabase
      .from('todo')
      .update({ completed: !currentStatus })
      .eq('id', todoId)
  }

  if (loading) {
    return (
      <div className="text-white">
        <div className="text-lg font-bold mb-3 uppercase tracking-wide">TO-DO</div>
        <div className="text-sm font-light text-white/60">Loading...</div>
      </div>
    )
  }

  return (
    <div className="text-white">
      <div className="text-lg font-bold mb-3 uppercase tracking-wide">TO-DO</div>
      {todos.length === 0 ? (
        <div className="text-sm font-light text-white/60">No todos.</div>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-start gap-2 text-lg font-light ${
                todo.completed 
                  ? 'text-white/40 line-through' 
                  : 'text-white'
              }`}
            >
              <input
                type="checkbox"
                checked={todo.completed ?? false}
                onChange={() => toggleTodo(todo.id, todo.completed)}
                className="w-4 h-4 mt-0.5 cursor-pointer accent-white border-white flex-shrink-0"
                style={{ accentColor: 'white' }}
              />
              <span className="flex-1 text-left">{todo.body || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
