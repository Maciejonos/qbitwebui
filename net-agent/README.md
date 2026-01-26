# net-agent

Lightweight network utility agent for qbitwebui. Runs alongside qBittorrent to provide network diagnostics from the same network perspective.

## Usage

Deploy with `network_mode: "service:qbittorrent"` to share qBittorrent's network namespace:

```yaml
services:
  qbittorrent:
    image: linuxserver/qbittorrent
    ports:
      - "8080:8080"
      - "9999:9999"  # net-agent port

  net-agent:
    image: ghcr.io/mac-torreon/qbitwebui-agent:latest
    network_mode: "service:qbittorrent"
    environment:
      - QBT_URL=http://localhost:8080  # qBittorrent is on localhost due to shared network
```

## Authentication

All endpoints (except `/health`) require a valid qBittorrent session. Pass the SID via:
- Header: `X-QBT-SID: <sid>`
- Cookie: `SID=<sid>`

The agent validates the SID by calling qBittorrent's API. If qBittorrent has authentication disabled (IP bypass), the agent auto-detects this and skips SID validation.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (no auth required) |
| `GET /ip` | External IP info via ipinfo.io |
| `GET /speedtest` | Run Ookla speedtest (optional `?server=ID`) |
| `GET /speedtest/servers` | List nearby speedtest servers |
| `GET /dns` | Show configured DNS servers |
| `GET /interfaces` | Network interface information |
| `GET /exec?cmd=...` | Execute allowed commands (curl, wget, dig, ping, etc.) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9999` | Port to listen on |
| `QBT_URL` | `http://localhost:8080` | qBittorrent WebUI URL for auth validation |
| `ALLOW_SELF_SIGNED_CERTS` | `false` | Accept self-signed TLS certificates for qBittorrent |

## Building

```bash
docker build -t qbitwebui-agent .
```

## Local Development

```bash
go run main.go
```
