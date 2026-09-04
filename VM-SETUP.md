## Installing Docker on a VM:

### Ubuntu/Debian:
```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose Plugin (v2) - RECOMMENDED
sudo apt install docker-compose-plugin

# Alternatively, Docker Compose v1 (legacy):
# sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

# Add the user to the docker group
sudo usermod -aG docker $USER

# IMPORTANT: Log out and back in, or run:
newgrp docker
```

## Deploying on a VM:

1. Upload the files to the server:
   ```bash
   scp -r ./bot-musica user@your-vm-ip:/home/user/
   ```

2. Connect via SSH and configure:
   ```bash
   ssh user@your-vm-ip
   cd /home/user/bot-musica
   cp .env.example .env
   nano .env  # Set TOKEN and CLIENT_ID
   ```

3. Start the bot:
   ```bash
   ./start-vm.sh
   ```

## Useful commands:

### Docker Compose v2 (recommended):
- View logs: `docker compose logs -f gordodj`
- Restart: `docker compose restart gordodj`
- Stop: `docker compose down`
- Update: `docker compose pull && docker compose up -d`
- View status: `docker compose ps`

### Docker Compose v1 (legacy):
- View logs: `docker-compose logs -f gordodj`
- Restart: `docker-compose restart gordodj`
- Stop: `docker-compose down`
- Update: `docker-compose pull && docker-compose up -d`
- View status: `docker-compose ps`

## Monitoring:

- Bot logs: `./logs/`
- Container status: `docker stats gordodj-bot`
- Healthcheck: `docker inspect gordodj-bot --format='{{.State.Health.Status}}'`

## Firewall (if needed):

```bash
# Only if you need to open specific ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (if you have a web dashboard)
sudo ufw allow 443   # HTTPS (if you have a web dashboard)
sudo ufw enable
```
