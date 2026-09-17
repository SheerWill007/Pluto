#!/bin/bash

echo "🚀 Starting Atlas Agent System..."
echo ""

# Kill any existing processes on these ports
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start backend
echo "📦 Starting Backend (Port 8000)..."
cd "$(dirname "$0")"
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --loop asyncio > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "🎨 Starting Frontend (Port 5173)..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo $FRONTEND_PID > .frontend.pid

sleep 2

echo ""
echo "✅ All servers started successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 Frontend:  http://localhost:5173"
echo "  🔧 Backend:   https://atlasmultiagentsystem.onrender.com"
echo "  📚 API Docs:  https://atlasmultiagentsystem.onrender.com/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 To stop servers: ./stop.sh"
echo "📋 To view logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
