#!/bin/bash

# Script para iniciar GordoDJ en VM usando Docker
# Uso: ./start-vm.sh [production|development]

set -e

ENV=${1:-production}
COMPOSE_FILE="docker-compose.yml"

echo "🚀 Iniciando GordoDJ en modo: $ENV"

# Verificar que Docker y Docker Compose están instalados
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Instálalo primero."
    exit 1
fi

# Verificar Docker Compose (funciona con v1 y v2)
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "✅ Usando docker-compose (v1)"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "✅ Usando docker compose (v2)"
else
    echo "❌ Docker Compose no está instalado. Instálalo primero."
    echo "💡 Para instalar Docker Compose v2: sudo apt install docker-compose-plugin"
    exit 1
fi

# Verificar que el archivo .env existe
if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado. Crea uno basado en .env.example"
    exit 1
fi

echo "📦 Construyendo imagen Docker..."
$COMPOSE_CMD -f $COMPOSE_FILE build

echo "🔄 Iniciando contenedores..."
$COMPOSE_CMD -f $COMPOSE_FILE up -d

echo "✅ GordoDJ iniciado exitosamente!"
echo "📊 Para ver logs: $COMPOSE_CMD logs -f"
echo "🛑 Para detener: $COMPOSE_CMD down"
echo "📈 Para ver estado: $COMPOSE_CMD ps"
