# Getting Started

## Requirements

- Docker (recommended) or Bun runtime
- A running qBittorrent instance with WebUI enabled

## Quick Start

```bash
docker run -d \
  --name qbitwebui \
  -p 3000:3000 \
  -v ./data:/data \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  ghcr.io/maciejonos/qbitwebui:latest
```

Open `http://localhost:3000` in your browser.

## First Setup

1. **Create Account** - Register with username and password (first user is admin)
2. **Add Instance** - Click **+** and enter your qBittorrent details:
   - Label: A name for this instance (e.g., "Seedbox")
   - URL: qBittorrent WebUI address (e.g., `http://192.168.1.100:8080`)
   - Username & Password: Your qBittorrent credentials
3. **Connect** - Click the instance card to start managing torrents

::: tip
If qBittorrent has "Bypass authentication for clients on localhost" enabled, check **Skip authentication** when adding the instance.
:::

## Docker Compose

### Minimal Setup

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    container_name: qbitwebui
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - ENCRYPTION_KEY=generate-a-32-char-key-here
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
      - ./data:/data
      - /path/to/downloads:/downloads:ro
    environment:
      - ENCRYPTION_KEY=generate-a-32-char-key-here
      - DOWNLOADS_PATH=/downloads
    restart: unless-stopped
```

## Generating Encryption Key

The `ENCRYPTION_KEY` is used to encrypt stored credentials. Generate a secure one:

```bash
openssl rand -hex 32
```

::: warning
Save this key securely. If you lose it, you'll need to re-add all instances.
:::

## Next Steps

- [Configuration](/guide/configuration) - Environment variables and options
- [Features](/guide/features) - All features explained
- [Docker](/guide/docker) - Full deployment examples
- [Network Agent](/guide/network-agent/) - Network diagnostics
