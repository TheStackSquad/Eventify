#!/bin/bash

# Test script for Feedback API with cookie handling
BASE_URL="http://localhost:8081"
ENDPOINT="/api/v1/feedback"
COOKIE_FILE="/tmp/feedback_test_cookies.txt"

echo "================================"
echo "Feedback API Test Suite"
echo "================================"
echo ""

# Clean up any previous cookie file
rm -f "$COOKIE_FILE"

# Test 1: Valid feedback with image URL
echo "Test 1: Valid feedback WITH image URL"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Mister Ben",
    "email": "mister@ben.com",
    "type": "complaint",
    "message": "Would be great to have dark mode option.",
    "imageUrl": "https://kphwpin3r1kcmjsx.public.blob.vercel-storage.com/feedback-images/vendorUI-aCDfW4wCMZKhcuvZgLTDPmG4wcpJD0.webp"
  }'
echo -e "\n\n"

# Test 2: Valid feedback WITHOUT image URL (field omitted)
echo "Test 2: Valid feedback WITHOUT image URL (field omitted)"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "type": "suggestion",
    "message": "Add more payment options please."
  }'
echo -e "\n\n"

# Test 3: Valid feedback with EMPTY string image URL
echo "Test 3: Valid feedback with EMPTY string image URL"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "type": "feedback",
    "message": "Great app overall!",
    "imageUrl": ""
  }'
echo -e "\n\n"

# Test 4: Valid feedback with null imageUrl
echo "Test 4: Valid feedback with NULL imageUrl"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Alice Wonder",
    "email": "alice@example.com",
    "type": "suggestion",
    "message": "Would love to see more themes!",
    "imageUrl": null
  }'
echo -e "\n\n"

# Test 5: Invalid - missing required field (email)
echo "Test 5: Invalid - missing required field (email)"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "No Email User",
    "type": "suggestion",
    "message": "This should fail."
  }'
echo -e "\n\n"

# Test 6: Invalid - wrong feedback type
echo "Test 6: Invalid - wrong feedback type"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Wrong Type",
    "email": "wrong@example.com",
    "type": "invalid_type",
    "message": "This should fail due to invalid type."
  }'
echo -e "\n\n"

# Test 7: Invalid - invalid email format
echo "Test 7: Invalid - invalid email format"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Bad Email",
    "email": "not-an-email",
    "type": "complaint",
    "message": "This should fail due to bad email."
  }'
echo -e "\n\n"

# Test 8: Invalid - empty message
echo "Test 8: Invalid - empty message"
curl -i -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "No Message",
    "email": "nomsg@example.com",
    "type": "feedback",
    "message": ""
  }'
echo -e "\n\n"

# Test 9: Valid - all three feedback types (with JSON parsing)
echo "Test 9a: Valid - suggestion type"
curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Suggester",
    "email": "suggest@example.com",
    "type": "suggestion",
    "message": "Add a search feature."
  }' | jq '.'
echo ""

echo "Test 9b: Valid - complaint type"
curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Complainer",
    "email": "complain@example.com",
    "type": "complaint",
    "message": "App is too slow."
  }' | jq '.'
echo ""

echo "Test 9c: Valid - feedback type"
curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Feedbacker",
    "email": "feedback@example.com",
    "type": "feedback",
    "message": "Love the new design!"
  }' | jq '.'
echo ""

# Test 10: Verify imageUrl in response
echo "Test 10: Verify imageUrl appears in response when provided"
curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
  -d '{
    "name": "Image Tester",
    "email": "image@example.com",
    "type": "feedback",
    "message": "Testing image URL in response.",
    "imageUrl": "https://example.com/test-image.jpg"
  }' | jq '.data | {id, imageUrl, message}'
echo ""

echo "================================"
echo "Test Suite Complete"
echo "================================"

# Clean up cookie file
rm -f "$COOKIE_FILE"