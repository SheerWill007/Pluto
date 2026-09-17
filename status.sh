#!/bin/bash

echo "Pluto Agent System Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check backend
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "Backend:  RUNNING on port 8000"
    BACKEND_PID=$(lsof -ti:8000)
    echo "   PID: $BACKEND_PID"
else
    echo "Backend:  NOT RUNNING"
fi

echo ""

# Check frontend
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "Frontend: RUNNING on port 5173"
    FRONTEND_PID=$(lsof -ti:5173)
    echo "   PID: $FRONTEND_PID"
else
    echo "Frontend: NOT RUNNING"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if both are running
if lsof -ti:8000 > /dev/null 2>&1 && lsof -ti:5173 > /dev/null 2>&1; then
    echo ""
    echo "Access the app at: http://localhost:5173"
    echo ""
fi
