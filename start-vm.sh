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

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Instálalo primero."
    exit 1
fi

# Verificar que el archivo .env existe
if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado. Crea uno basado en .env.example"
    exit 1
fi

# Crear directorios necesarios
mkdir -p data logs

echo "📦 Construyendo imagen Docker..."
docker-compose -f $COMPOSE_FILE build

echo "🔄 Iniciando contenedores..."
docker-compose -f $COMPOSE_FILE up -d

echo "✅ GordoDJ iniciado exitosamente!"
echo "📊 Para ver logs: docker-compose logs -f"
echo "🛑 Para detener: docker-compose down"
echo "📈 Para ver estado: docker-compose ps"
