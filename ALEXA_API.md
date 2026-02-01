# Alexa API Integration

This document describes the API endpoints for Alexa integration.

## Base URL
All endpoints are under `/api/alexa/`

## Authentication
All endpoints require the `x-mirror-secret` header:
```
x-mirror-secret: <ALEXA_SHARED_SECRET>
```

## Endpoints

### 1. Add Todo
**POST** `/api/alexa/todo/add`

Adds a new todo item to the list.

**Request Body:**
```json
{
  "text": "Buy groceries",
  "body": "Buy groceries",  // Alternative field name
  "item": "Buy groceries"   // Alternative field name
}
```

**Response:**
```json
{
  "ok": true,
  "todoId": 123
}
```

**Example Lambda Call:**
```python
import urllib.request
import json
import os

def add_todo(item_text):
    url = f"{os.environ['VERCEL_API_URL']}/api/alexa/todo/add"
    body = json.dumps({"text": item_text}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-mirror-secret": os.environ["ALEXA_SHARED_SECRET"]
        },
        method="POST"
    )
    urllib.request.urlopen(req)
```

---

### 2. Remove Todo
**POST** `/api/alexa/todo/remove`

Removes a todo item from the list.

**Request Body:**
```json
{
  "id": 123,              // Option 1: Remove by ID
  "text": "Buy groceries" // Option 2: Remove by matching text (first match)
}
```

**Response:**
```json
{
  "ok": true,
  "deleted": true
}
```

**Example Lambda Call:**
```python
def remove_todo(item_text):
    url = f"{os.environ['VERCEL_API_URL']}/api/alexa/todo/remove"
    body = json.dumps({"text": item_text}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-mirror-secret": os.environ["ALEXA_SHARED_SECRET"]
        },
        method="POST"
    )
    urllib.request.urlopen(req)
```

---

### 3. Complete Todo
**POST** `/api/alexa/todo/complete`

Marks a todo item as completed or incomplete.

**Request Body:**
```json
{
  "id": 123,              // Option 1: Update by ID
  "text": "Buy groceries", // Option 2: Update by matching text (first match)
  "completed": true        // Optional, defaults to true
}
```

**Response:**
```json
{
  "ok": true,
  "todoId": 123,
  "completed": true
}
```

**Example Lambda Call:**
```python
def complete_todo(item_text):
    url = f"{os.environ['VERCEL_API_URL']}/api/alexa/todo/complete"
    body = json.dumps({"text": item_text, "completed": True}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-mirror-secret": os.environ["ALEXA_SHARED_SECRET"]
        },
        method="POST"
    )
    urllib.request.urlopen(req)
```

---

### 4. Add Calendar Event
**POST** `/api/alexa/event/add`

Adds a new calendar event.

**Request Body:**
```json
{
  "task": "Team Meeting",
  "date": "2026-02-15",    // YYYY-MM-DD format
  "time": "14:30"           // HH:MM format (optional)
}
```

**Alternative formats supported:**
```json
{
  "title": "Team Meeting",   // Alternative to "task"
  "item": "Team Meeting",    // Alternative to "task"
  "startAt": "2026-02-15T14:30:00Z"  // Will be parsed into date and time
}
```

**Response:**
```json
{
  "ok": true,
  "eventId": 456
}
```

**Example Lambda Call (with ReminderIntent extracted data):**
```python
def add_calendar_event(reminder_data):
    # reminder_data is the JSON extracted from Bedrock Agent
    # Format: {"task": "...", "date": "2026-02-15", "time": "14:30", "confidence": 0.9}
    
    url = f"{os.environ['VERCEL_API_URL']}/api/alexa/event/add"
    body = json.dumps({
        "task": reminder_data.get("task"),
        "date": reminder_data.get("date"),
        "time": reminder_data.get("time")
    }).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-mirror-secret": os.environ["ALEXA_SHARED_SECRET"]
        },
        method="POST"
    )
    urllib.request.urlopen(req)
```

---

## Real-time UI Updates

The UI automatically updates in real-time when data changes in the database:
- **TodoWidget** subscribes to changes in the `todo` table
- **CalendarWidget** subscribes to changes in the `calendar` table

No additional API calls needed - the Supabase Realtime subscriptions handle UI updates automatically.

---

## Error Responses

All endpoints return standard error responses:

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request:**
```json
{
  "error": "Invalid input: text/body/item is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create todo",
  "details": "Error message from database"
}
```
