# Enable Supabase Realtime for Auto-Updates

For the UI to automatically update when Alexa adds/removes/updates todos and calendar events, you need to enable Realtime replication in Supabase.

## Steps to Enable Realtime

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Enable Realtime for Tables**
   - Go to **Database** → **Replication** (or **Database** → **Realtime**)
   - Find the following tables:
     - `todo`
     - `calendar`
   - Toggle **ON** the replication switch for each table

3. **Alternative Method (SQL)**
   If you prefer SQL, run this in the SQL Editor:

   ```sql
   -- Enable Realtime for todo table
   ALTER PUBLICATION supabase_realtime ADD TABLE todo;
   
   -- Enable Realtime for calendar table
   ALTER PUBLICATION supabase_realtime ADD TABLE calendar;
   ```

4. **Verify Realtime is Enabled**
   - Go back to Database → Replication
   - You should see `todo` and `calendar` listed with replication enabled
   - The status should show as active

## How It Works

Once Realtime is enabled:
- When Alexa adds a todo → Database updates → Realtime event fires → UI updates automatically
- When Alexa removes a todo → Database updates → Realtime event fires → UI updates automatically
- When Alexa marks todo complete → Database updates → Realtime event fires → UI updates automatically
- When Alexa adds calendar event → Database updates → Realtime event fires → UI updates automatically

## Troubleshooting

If real-time updates still don't work after enabling Realtime:

1. **Check Browser Console**
   - Open browser DevTools (F12)
   - Look for subscription status messages
   - Should see: "Successfully subscribed to todo changes" and "Successfully subscribed to calendar changes"

2. **Check Supabase Dashboard**
   - Go to Database → Replication
   - Verify tables are listed and enabled

3. **Check Network Tab**
   - In DevTools → Network tab
   - Filter for "realtime" or "websocket"
   - Should see WebSocket connection to Supabase

4. **Verify Environment Variables**
   - Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
   - Restart your dev server after changing env vars

5. **Check RLS Policies**
   - Realtime requires SELECT permissions
   - Make sure RLS policies allow reading from `todo` and `calendar` tables
