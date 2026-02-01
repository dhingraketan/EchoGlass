#!/bin/bash

# Test YouTube API endpoint
# Replace YOUR_SECRET with your actual ALEXA_SHARED_SECRET

curl -X POST https://echo-glass-mu.vercel.app/api/alexa \
  -H "Content-Type: application/json" \
  -H "x-mirror-secret: YOUR_SECRET" \
  -d '{"action": "youtube", "data": {}}'

echo ""
