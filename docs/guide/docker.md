# Docker Deployment

## Images

| Image | Description |
|-------|-------------|
| `ghcr.io/maciejonos/qbitwebui` | Main application |
| `ghcr.io/maciejonos/qbitwebui-agent` | Network diagnostics agent |

Both support `linux/amd64` and `linux/arm64`.

## Quick Start

```bash
docker run -d \
  --name qbitwebui \
  -p 3000:3000 \
  -v ./data:/data \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  ghcr.io/maciejonos/qbitwebui:latest
```

## Docker Compose Examples

### Basic

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./qbitwebui-data:/data
    environment:
      - ENCRYPTION_KEY=your-32-character-minimum-key-here
    restart: unless-stopped
```

### With File Browser

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./qbitwebui-data:/data
      - /path/to/your/downloads:/downloads:ro
    environment:
      - ENCRYPTION_KEY=your-32-character-minimum-key-here
      - DOWNLOADS_PATH=/downloads
    restart: unless-stopped
```

### Full Stack (qBittorrent + Agent + qbitwebui)

Complete setup with all components:

```yaml
services:
  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/London
      - WEBUI_PORT=8080
    volumes:
      - ./qbittorrent-config:/config
      - ./downloads:/downloads
    ports:
      - "8080:8080"      # qBittorrent WebUI
      - "6881:6881"      # BitTorrent TCP
      - "6881:6881/udp"  # BitTorrent UDP
      - "9876:9876"      # Network Agent
    restart: unless-stopped

  net-agent:
    image: ghcr.io/maciejonos/qbitwebui-agent:latest
    container_name: net-agent
    network_mode: "service:qbittorrent"
    environment:
      - QBT_URL=http://localhost:8080
    depends_on:
      - qbittorrent
    restart: unless-stopped

  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./qbitwebui-data:/data
      - ./downloads:/downloads:ro
    environment:
      - ENCRYPTION_KEY=your-32-character-minimum-key-here
      - DOWNLOADS_PATH=/downloads
    depends_on:
      - qbittorrent
    restart: unless-stopped
```

### With VPN (Gluetun)

Route qBittorrent through a VPN:

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun:latest
    container_name: gluetun
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun:/dev/net/tun
    environment:
      - VPN_SERVICE_PROVIDER=mullvad  # or your provider
      - VPN_TYPE=wireguard
      - WIREGUARD_PRIVATE_KEY=your-private-key
      - WIREGUARD_ADDRESSES=10.x.x.x/32
      - SERVER_COUNTRIES=Sweden
    ports:
      - "8080:8080"      # qBittorrent WebUI
      - "6881:6881"      # BitTorrent
      - "6881:6881/udp"
      - "9876:9876"      # Network Agent
    restart: unless-stopped

  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: "service:gluetun"
    environment:
      - PUID=1000
      - PGID=1000
      - WEBUI_PORT=8080
    volumes:
      - ./qbittorrent-config:/config
      - ./downloads:/downloads
    depends_on:
      - gluetun
    restart: unless-stopped

  net-agent:
    image: ghcr.io/maciejonos/qbitwebui-agent:latest
    container_name: net-agent
    network_mode: "service:gluetun"
    environment:
      - QBT_URL=http://localhost:8080
    depends_on:
      - qbittorrent
    restart: unless-stopped

  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./qbitwebui-data:/data
      - ./downloads:/downloads:ro
    environment:
      - ENCRYPTION_KEY=your-32-character-minimum-key-here
      - DOWNLOADS_PATH=/downloads
    depends_on:
      - qbittorrent
    restart: unless-stopped
```

::: tip
With VPN setup, use the Network Agent to verify your VPN is working correctly by checking the external IP.
:::

### Multiple Instances

Manage multiple qBittorrent instances:

```yaml
services:
  qbittorrent-1:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent-1
    environment:
      - PUID=1000
      - PGID=1000
      - WEBUI_PORT=8080
    volumes:
      - ./qbt1-config:/config
      - ./downloads-1:/downloads
    ports:
      - "8080:8080"
      - "6881:6881"
      - "6881:6881/udp"
    restart: unless-stopped

  qbittorrent-2:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent-2
    environment:
      - PUID=1000
      - PGID=1000
      - WEBUI_PORT=8080
    volumes:
      - ./qbt2-config:/config
      - ./downloads-2:/downloads
    ports:
      - "8081:8080"
      - "6882:6881"
      - "6882:6881/udp"
    restart: unless-stopped

  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./qbitwebui-data:/data
    environment:
      - ENCRYPTION_KEY=your-32-character-minimum-key-here
    restart: unless-stopped
```

Add both instances in qbitwebui with their respective URLs (`http://host:8080` and `http://host:8081`).

## Reverse Proxy

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name qbit.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
qbit.example.com {
    reverse_proxy localhost:3000
}
```

### Traefik (Labels)

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.qbitwebui.rule=Host(`qbit.example.com`)"
      - "traefik.http.routers.qbitwebui.entrypoints=websecure"
      - "traefik.http.routers.qbitwebui.tls=true"
      - "traefik.http.routers.qbitwebui.tls.certresolver=letsencrypt"
      - "traefik.http.services.qbitwebui.loadbalancer.server.port=3000"
    # ... rest of config
```

### With External Authentication

Using Authelia, Authentik, or similar:

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    environment:
      - ENCRYPTION_KEY=your-key
      - DISABLE_AUTH=true  # Let reverse proxy handle auth
    # ... rest of config
```

## Updating

### Manual

```bash
docker compose pull
docker compose up -d
```

### Watchtower (Automatic)

```yaml
services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_SCHEDULE=0 0 4 * * *  # 4 AM daily
    restart: unless-stopped
```

## Volumes

| Path | Description |
|------|-------------|
| `/data` | Database and encryption salt (required) |
| `/downloads` | Downloads directory for file browser (optional) |

## Ports

| Port | Service |
|------|---------|
| `3000` | qbitwebui web interface |
| `9876` | Network agent (exposed through qBittorrent container) |

## Health Check

qbitwebui exposes `/api/config` for health checks:

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/config"]
  interval: 30s
  timeout: 10s
  retries: 3
```
