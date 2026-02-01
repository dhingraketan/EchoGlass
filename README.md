# EchoGlass Smart Mirror

A smart mirror web application built with Next.js, TypeScript, Supabase, and Tailwind CSS. Designed to run on a large display with a glanceable, high-contrast dark theme interface.

## Features

- **Dashboard UI**: Full-screen mirror interface with widgets for time, weather, calendar, todos, and status
- **Real-time Updates**: Live updates via Supabase Realtime subscriptions
- **Alexa Integration**: Secure API endpoints for AWS Lambda to add todos/events and query today's summary
- **Admin Panel**: CRUD operations for todos and events, plus command log viewer
- **Single User Setup**: No authentication required - configured via environment variable

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS

## Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project
- (Optional) OpenWeather API key for weather data

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration script from `supabase/migrations/001_initial_schema.sql`
3. Enable Realtime for the following tables:
   - Go to Database → Replication
   - Enable replication for `todos`, `events`, and `command_logs` tables

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Fill in the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_HOUSEHOLD_ID=your_household_id_uuid
ALEXA_SHARED_SECRET=your_secure_random_secret_here
NEXT_PUBLIC_WEATHER_API_KEY=your_openweather_api_key_optional
```

**Where to find Supabase credentials:**
- Go to your Supabase project → Settings → API
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key (keep this secret!)

**Household ID:**
- `NEXT_PUBLIC_HOUSEHOLD_ID`: A UUID that identifies your household. Generate one with:
```bash
uuidgen
# or
node -e "console.log(require('crypto').randomUUID())"
```

**Generate a secure secret for Alexa:**
```bash
openssl rand -hex 32
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy!

**Required Environment Variables for Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_HOUSEHOLD_ID`
- `ALEXA_SHARED_SECRET`
- `NEXT_PUBLIC_WEATHER_API_KEY` (optional)

## API Endpoints for Alexa Lambda

All Alexa endpoints require the `x-mirror-secret` header with your `ALEXA_SHARED_SECRET` value.

### POST `/api/alexa/todo/add`

Add a new todo item.

**Request:**
```bash
curl -X POST https://your-domain.vercel.app/api/alexa/todo/add \
  -H "Content-Type: application/json" \
  -H "x-mirror-secret: your_secret_here" \
  -d '{
    "householdId": "user-uuid-here",
    "text": "Buy groceries",
    "dueAt": "2024-01-15T10:00:00Z"
  }'
```

**Response:**
```json
{
  "ok": true,
  "todoId": "todo-uuid"
}
```

### POST `/api/alexa/event/add`

Add a new calendar event.

**Request:**
```bash
curl -X POST https://your-domain.vercel.app/api/alexa/event/add \
  -H "Content-Type: application/json" \
  -H "x-mirror-secret: your_secret_here" \
  -d '{
    "householdId": "user-uuid-here",
    "title": "Team Meeting",
    "startAt": "2024-01-15T14:00:00Z",
    "endAt": "2024-01-15T15:00:00Z",
    "location": "Conference Room A",
    "notes": "Quarterly review"
  }'
```

**Response:**
```json
{
  "ok": true,
  "eventId": "event-uuid"
}
```

### GET `/api/alexa/today`

Get today's summary (open todos count and next event).

**Request:**
```bash
curl -X GET "https://your-domain.vercel.app/api/alexa/today?householdId=user-uuid-here" \
  -H "x-mirror-secret: your_secret_here"
```

**Response:**
```json
{
  "ok": true,
  "openTodosCount": 5,
  "nextEvent": {
    "id": "event-uuid",
    "title": "Team Meeting",
    "start_at": "2024-01-15T14:00:00Z",
    ...
  }
}
```

### POST `/api/alexa/ping`

Health check endpoint for Lambda.

**Request:**
```bash
curl -X POST https://your-domain.vercel.app/api/alexa/ping \
  -H "x-mirror-secret: your_secret_here"
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "server": "EchoGlass Mirror API"
}
```

## Example Lambda Payloads

### Adding a Todo

```json
{
  "householdId": "00000000-0000-0000-0000-000000000000",
  "text": "Pick up dry cleaning",
  "dueAt": "2024-01-20T18:00:00Z"
}
```

### Adding an Event

```json
{
  "householdId": "00000000-0000-0000-0000-000000000000",
  "title": "Doctor Appointment",
  "startAt": "2024-01-18T10:00:00Z",
  "endAt": "2024-01-18T11:00:00Z",
  "location": "Medical Center",
  "notes": "Annual checkup"
}
```

## Project Structure

```
EchoGlass/
├── app/
│   ├── api/
│   │   └── alexa/          # Alexa API endpoints
│   ├── admin/               # Admin panel page
│   ├── dashboard/           # Main mirror dashboard
│   ├── login/               # Login page
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page (redirects)
├── components/              # React components
│   ├── CalendarWidget.tsx
│   ├── NewsTicker.tsx
│   ├── StatusWidget.tsx
│   ├── TimeWidget.tsx
│   ├── TodoWidget.tsx
│   └── WeatherWidget.tsx
├── lib/
│   ├── supabase/            # Supabase client utilities
│   ├── types.ts             # TypeScript types
│   └── rate-limit.ts        # Rate limiting utility
├── supabase/
│   └── migrations/          # Database migrations
└── middleware.ts             # Auth middleware
```

## Security Notes

- **Rate Limiting**: Simple in-memory rate limiting (100 requests/minute per IP). For production, use Redis or a dedicated service.
- **RLS Policies**: Currently permissive for MVP. Update Row Level Security policies in Supabase for production.
- **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. Only use in API routes.
- **Alexa Secret**: Use a strong random secret and keep it secure. Share only with your Lambda function.

## Troubleshooting

### Real-time updates not working
- Ensure Realtime is enabled for tables in Supabase Dashboard → Database → Replication
- Check browser console for WebSocket connection errors

### Dashboard not loading
- Verify `NEXT_PUBLIC_HOUSEHOLD_ID` is set in `.env.local`
- Ensure the household_id matches the one used in your database records

### API endpoints returning 401
- Verify `x-mirror-secret` header matches `ALEXA_SHARED_SECRET` environment variable
- Check Vercel environment variables are set correctly

## Future Enhancements

- [ ] Household management (multiple users per household)
- [ ] Weather API integration (OpenWeather)
- [ ] News API integration for headlines
- [ ] Customizable widget layout
- [ ] AR Try-On Mode implementation
- [ ] Voice commands via browser Speech API
- [ ] Mobile app companion

## License

MIT
