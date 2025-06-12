## Instalación de Docker en VM:

### Ubuntu/Debian:
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose Plugin (v2) - RECOMENDADO
sudo apt install docker-compose-plugin

# Alternativamente, Docker Compose v1 (legacy):
# sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# IMPORTANTE: Reiniciar sesión o ejecutar:
newgrp docker
```

## Despliegue en VM:

1. Subir archivos al servidor:
   ```bash
   scp -r ./bot-musica user@your-vm-ip:/home/user/
   ```

2. Conectar por SSH y configurar:
   ```bash
   ssh user@your-vm-ip
   cd /home/user/bot-musica
   cp .env.example .env
   nano .env  # Configurar TOKEN y CLIENT_ID
   ```

3. Iniciar el bot:
   ```bash
   ./start-vm.sh
   ```

## Comandos útiles:

### Docker Compose v2 (recomendado):
- Ver logs: `docker compose logs -f gordodj`
- Reiniciar: `docker compose restart gordodj`
- Detener: `docker compose down`
- Actualizar: `docker compose pull && docker compose up -d`
- Ver estado: `docker compose ps`

### Docker Compose v1 (legacy):
- Ver logs: `docker-compose logs -f gordodj`
- Reiniciar: `docker-compose restart gordodj`
- Detener: `docker-compose down`
- Actualizar: `docker-compose pull && docker-compose up -d`
- Ver estado: `docker-compose ps`

## Monitoreo:

- Logs del bot: `./logs/`
- Estado del contenedor: `docker stats gordodj-bot`
- Healthcheck: `docker inspect gordodj-bot --format='{{.State.Health.Status}}'`

## Firewall (si es necesario):

```bash
# Solo si necesitas abrir puertos específicos
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (si tienes dashboard web)
sudo ufw allow 443   # HTTPS (si tienes dashboard web)
sudo ufw enable
```
