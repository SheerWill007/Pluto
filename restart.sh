#!/bin/bash

echo "Restarting Pluto Agent System..."
echo ""

./stop.sh
sleep 2
./start.sh
