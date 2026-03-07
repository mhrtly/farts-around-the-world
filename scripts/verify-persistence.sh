#!/usr/bin/env bash
# Verify that the FATWA backend persists data across requests
# Usage: ./scripts/verify-persistence.sh https://fartsaroundtheworld.com

BASE_URL="${1:-http://localhost:3001}"

echo "=== FATWA Persistence Verification ==="
echo "Target: $BASE_URL"
echo ""

# 1. Check health
echo "1. Health check..."
HEALTH=$(curl -s "$BASE_URL/api/health")
echo "   $HEALTH"
echo ""

# 2. Get current event count
echo "2. Current stats..."
STATS=$(curl -s "$BASE_URL/api/stats")
echo "   $STATS" | head -c 200
echo ""
echo ""

# 3. Submit a test event
echo "3. Submitting test event..."
RESULT=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 0.0,
    "lng": 0.0,
    "intensity": 5,
    "country": "US",
    "type": "standard"
  }')
echo "   $RESULT" | head -c 200
echo ""
echo ""

# 4. Fetching recent events...
echo "4. Fetching recent events..."
EVENTS=$(curl -s "$BASE_URL/api/events?limit=5")
echo "   $EVENTS" | head -c 300
echo ""
echo ""

echo "=== Done. If you see the test event in step 4, persistence is working. ==="
echo "=== To test across deploys: run this, trigger a redeploy, run again. ==="
