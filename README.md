# qbitwebui

A modern lightweight web interface for qBittorrent, built with Vite.

[More images below](#preview)
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/4d8acb4b-a474-4c31-8ece-edd3a88cee7d" alt="demo_new" /></td>
    <td><img src="https://github.com/user-attachments/assets/3547bbed-8cba-4031-9b58-2c4c73d3a9f2" alt="demo_catppuccin" /></td>
  </tr>
</table>

## Features

- Real-time torrent monitoring with auto-refresh
- Add torrents via magnet links or .torrent files
- Detailed torrent view with file priority control, trackers, peers
- Filter by status, category, tag, or tracker
- Sortable columns, keyboard navigation
- Context menu, multi-select, bulk actions
- Tag/category management, configurable ratio thresholds
- Multiple themes, update notifications

## Docker

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    ports:
      - "8080:80"
    environment:
      - QBITTORRENT_URL=http://localhost:8080
    restart: unless-stopped
```

### Bypass Authentication

If your qBittorrent instance has authentication disabled, you can skip the login screen entirely:

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    ports:
      - "8080:80"
    environment:
      - QBITTORRENT_URL=http://localhost:8080
      - BYPASS_AUTH=true
    restart: unless-stopped
```

> **Note:** Only use this when qBittorrent's web API has authentication disabled (`WebUI\AuthSubnetWhitelist` or similar settings).

Or build locally:

```bash
docker compose up -d
```

## Development

```bash
# Set qBittorrent backend URL
export QBITTORRENT_URL=http://localhost:8080

# Install and run
npm install
npm run dev
```

## Tech Stack

React 19, TypeScript, Tailwind CSS v4, Vite, TanStack Query

## Preview
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/b2aa1367-00ad-4ddb-ae5f-0f364046a435" alt="demo3" /></td>
    <td><img src="https://github.com/user-attachments/assets/048245a9-e751-4965-9ad9-862570079019" alt="demo4" /></td>
  </tr>
</table>
