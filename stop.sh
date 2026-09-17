#!/bin/bash

echo "Stopping Pluto Agent System..."
echo ""

# Kill by PID files if they exist
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    kill -9 $BACKEND_PID 2>/dev/null && echo "Backend stopped (PID: $BACKEND_PID)"
    rm .backend.pid
fi

if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    kill -9 $FRONTEND_PID 2>/dev/null && echo "Frontend stopped (PID: $FRONTEND_PID)"
    rm .frontend.pid
fi

# Also kill by port (backup method)
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Port 8000 freed"
lsof -ti:5173 | xargs kill -9 2>/dev/null && echo "Port 5173 freed"

# Kill any remaining node/python processes related to the project
pkill -f "uvicorn" 2>/dev/null
pkill -f "vite.*5173" 2>/dev/null

echo ""
echo "All servers stopped!"
echo ""
