'use client'

export default function SetupScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-lg p-8">
        <h1 className="text-4xl font-bold text-white mb-6">Setup Required</h1>
        <p className="text-gray-300 mb-6 text-lg">
          Please create a <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">.env.local</code> file in the project root with your Supabase credentials.
        </p>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Setup:</h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-300">
            <li>
              Copy the template file:
              <pre className="bg-black p-3 rounded mt-2 text-sm overflow-x-auto">
                <code className="text-green-400">cp env.template .env.local</code>
              </pre>
            </li>
            <li>
              Get your Supabase credentials from{' '}
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Supabase Dashboard
              </a>
              {' '}→ Settings → API
            </li>
            <li>
              Generate a UUID for HOUSEHOLD_ID:
              <pre className="bg-black p-3 rounded mt-2 text-sm overflow-x-auto">
                <code className="text-green-400">uuidgen</code>
                <br />
                <code className="text-gray-500"># or</code>
                <br />
                <code className="text-green-400">node -e &quot;console.log(require(&apos;crypto&apos;).randomUUID())&quot;</code>
              </pre>
            </li>
            <li>
              Fill in your <code className="bg-gray-700 px-1 rounded">.env.local</code> file with:
              <pre className="bg-black p-3 rounded mt-2 text-sm overflow-x-auto">
                <code className="text-yellow-300">NEXT_PUBLIC_SUPABASE_URL</code>=https://your-project.supabase.co{'\n'}
                <code className="text-yellow-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>=your_anon_key{'\n'}
                <code className="text-yellow-300">SUPABASE_SERVICE_ROLE_KEY</code>=your_service_role_key{'\n'}
                <code className="text-yellow-300">NEXT_PUBLIC_HOUSEHOLD_ID</code>=your-generated-uuid{'\n'}
                <code className="text-yellow-300">ALEXA_SHARED_SECRET</code>=your_secret
              </pre>
            </li>
            <li>
              Restart your dev server:
              <pre className="bg-black p-3 rounded mt-2 text-sm overflow-x-auto">
                <code className="text-green-400">npm run dev</code>
              </pre>
            </li>
          </ol>
        </div>

        <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
          <p className="text-blue-200 text-sm">
            <strong>Note:</strong> After creating <code className="bg-blue-900 px-1 rounded">.env.local</code>, you must restart the Next.js dev server for the changes to take effect.
          </p>
        </div>
      </div>
    </div>
  )
}
