#!/bin/bash

# Script to start GordoDJ on a VM using Docker
# Usage: ./start-vm.sh [production|development]

set -e

ENV=${1:-production}
COMPOSE_FILE="docker-compose.yml"

echo "🚀 Starting GordoDJ in mode: $ENV"

# Check that Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Install it first."
    exit 1
fi

# Check Docker Compose (works with v1 and v2)
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "✅ Using docker-compose (v1)"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "✅ Using docker compose (v2)"
else
    echo "❌ Docker Compose is not installed. Install it first."
    echo "💡 To install Docker Compose v2: sudo apt install docker-compose-plugin"
    exit 1
fi

# Check that the .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Create one based on .env.example"
    exit 1
fi

echo "📦 Building Docker image..."
$COMPOSE_CMD -f $COMPOSE_FILE build

echo "🔄 Starting containers..."
$COMPOSE_CMD -f $COMPOSE_FILE up -d

echo "✅ GordoDJ started successfully!"
echo "📊 To view logs: $COMPOSE_CMD logs -f"
echo "🛑 To stop: $COMPOSE_CMD down"
echo "📈 To view status: $COMPOSE_CMD ps"
