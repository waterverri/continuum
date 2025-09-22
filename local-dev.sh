#!/bin/bash

# Local Development Setup Script for Continuum
# This script starts both frontend and backend for local testing

echo "🚀 Starting Continuum Local Development Environment"

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Stopping development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if environment files exist
if [ ! -f "./dashboard/.env.local" ]; then
    echo "❌ Missing dashboard/.env.local file"
    echo "📋 Copy dashboard/.env.local.template to dashboard/.env.local"
    echo "   Then fill in your actual Supabase values"
    exit 1
fi

if [ ! -f "./api/.env" ]; then
    echo "❌ Missing api/.env file"
    echo "📋 Copy api/.env.template to api/.env"
    echo "   Then fill in your actual Supabase values"
    exit 1
fi

# Start backend API
echo "📡 Starting backend API on port 8080..."
cd api
npm install &>/dev/null
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Start frontend
echo "🌐 Starting frontend on port 5173..."
cd dashboard
npm install &>/dev/null
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 2

echo ""
echo "✅ Development environment ready!"
echo "📱 Frontend: http://localhost:5173"
echo "🔌 Backend:  http://localhost:8080"
echo ""
echo "⚠️  IMPORTANT: For local development authentication:"
echo "   1. Use EMAIL/PASSWORD login (not Google OAuth)"
echo "   2. Create a test account in your Supabase Auth dashboard if needed"
echo "   3. Production OAuth settings remain unchanged"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait