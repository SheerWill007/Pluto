#!/bin/bash

echo "🔄 Restarting Atlas Agent System..."
echo ""

./stop.sh
sleep 2
./start.sh
