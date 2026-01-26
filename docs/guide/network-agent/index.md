# Network Agent

A lightweight companion service that provides network diagnostics from your qBittorrent host's perspective.

## Why Use It?

When qBittorrent runs behind a VPN or on a remote server, you need to verify the network from that machine's perspective:

- **VPN Verification** - Check external IP to confirm VPN is active
- **Speed Testing** - Run speedtests from the actual download location
- **DNS Debugging** - View configured DNS servers, check for leaks
- **Connectivity Testing** - Ping, traceroute, dig from the host

The agent runs in the same network namespace as qBittorrent, so all diagnostics reflect exactly what qBittorrent sees.

## Features

| Feature | Description |
|---------|-------------|
| **IP Check** | External IP, city, region, country, ISP via ipinfo.io |
| **Speedtest** | Ookla speedtest with server selection |
| **DNS** | View /etc/resolv.conf nameservers |
| **Interfaces** | List network interfaces with IPs and status |
| **Terminal** | Execute ping, dig, nslookup, traceroute, curl, wget |

## Setup

### Basic (alongside qBittorrent)

```yaml
services:
  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent
    ports:
      - "8080:8080"
      - "9999:9999"  # Agent port
    volumes:
      - ./config:/config
      - ./downloads:/downloads
    restart: unless-stopped

  net-agent:
    image: ghcr.io/Maciejonos/qbitwebui-agent:latest
    container_name: net-agent
    network_mode: "service:qbittorrent"
    environment:
      - QBT_URL=http://localhost:8080
    depends_on:
      - qbittorrent
    restart: unless-stopped
```

### With VPN (Gluetun)

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
      - VPN_SERVICE_PROVIDER=your-provider
      - VPN_TYPE=wireguard
      # ... your VPN config
    ports:
      - "8080:8080"
      - "9999:9999"
    restart: unless-stopped

  qbittorrent:
    image: linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: "service:gluetun"
    volumes:
      - ./config:/config
      - ./downloads:/downloads
    depends_on:
      - gluetun
    restart: unless-stopped

  net-agent:
    image: ghcr.io/Maciejonos/qbitwebui-agent:latest
    container_name: net-agent
    network_mode: "service:gluetun"
    environment:
      - QBT_URL=http://localhost:8080
    depends_on:
      - qbittorrent
    restart: unless-stopped
```

::: tip
With VPN setups, running the IP check will show the VPN's IP, not your home IP - confirming the VPN is working.
:::

## Enable in qbitwebui

1. Go to the dashboard
2. Click edit on your instance
3. Check **Enable Network Agent**
4. Save

The **Network Tools** section will appear in the Tools menu.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9999` | Port the agent listens on |
| `QBT_URL` | `http://localhost:8080` | qBittorrent WebUI URL for auth |
| `ALLOW_SELF_SIGNED_CERTS` | `false` | Accept self-signed TLS certificates |

## Authentication

The agent validates requests by checking the qBittorrent session (SID). Only users with valid qBittorrent sessions can access the agent.

**Auto-detection**: If qBittorrent has authentication disabled (localhost bypass), the agent automatically detects this and skips SID validation.

## Terminal Commands

The terminal supports these commands:

| Command | Example |
|---------|---------|
| `ping` | `ping -c 4 8.8.8.8` |
| `dig` | `dig google.com` |
| `nslookup` | `nslookup example.com` |
| `traceroute` | `traceroute 1.1.1.1` |
| `curl` | `curl -I https://example.com` |
| `wget` | `wget -q -O- https://ifconfig.me` |

## Troubleshooting

### Agent shows "Offline"

1. **Check container is running**:
   ```bash
   docker ps | grep net-agent
   ```

2. **Check logs**:
   ```bash
   docker logs net-agent
   ```

3. **Verify port is exposed**: Port 9999 must be exposed on the container that owns the network:
   - Without VPN: on qBittorrent container
   - With VPN: on Gluetun container

4. **Test connectivity**:
   ```bash
   curl http://your-host:9999/health
   # Should return: {"status":"ok"}
   ```

### Authentication Errors

- **Wrong QBT_URL**: Verify the URL is correct and accessible from inside the container
- **Self-signed cert**: Set `ALLOW_SELF_SIGNED_CERTS=true` if qBittorrent uses HTTPS with self-signed certificate
- **qBittorrent not ready**: Ensure qBittorrent is fully started before agent tries to connect

### Speedtest Fails

- Check agent logs for specific errors
- Some networks block speedtest servers
- The Ookla CLI auto-accepts license on first run

## API Endpoints

For advanced users or automation:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | No | Health check |
| `GET /ip` | Yes | External IP info |
| `GET /speedtest` | Yes | Run speedtest (`?server=ID` optional) |
| `GET /speedtest/servers` | Yes | List nearby servers |
| `GET /dns` | Yes | DNS configuration |
| `GET /interfaces` | Yes | Network interfaces |
| `GET /exec?cmd=...` | Yes | Execute command |

Pass authentication via `X-QBT-SID` header or `SID` cookie.
