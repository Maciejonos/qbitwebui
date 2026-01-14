<div align="center">
 <img width="200" height="200" alt="logo" src="https://github.com/user-attachments/assets/431cf92d-d8e6-4be7-a5b6-642ed6ab9898" />

### A modern web interface for managing multiple qBittorrent instances

Built with [React](https://react.dev/), [Hono](https://hono.dev/), and [Bun](https://bun.sh/)

[![GitHub stars](https://img.shields.io/github/stars/Maciejonos/qbitwebui?style=for-the-badge&labelColor=101418&color=9ccbfb)](https://github.com/Maciejonos/qbitwebui/stargazers)
[![GitHub License](https://img.shields.io/github/license/Maciejonos/qbitwebui?style=for-the-badge&labelColor=101418&color=abedd5)](https://github.com/Maciejonos/qbitwebui/blob/master/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/Maciejonos/qbitwebui?style=for-the-badge&labelColor=101418&color=b9c8da)](https://github.com/Maciejonos/qbitwebui/releases)
[![Docker Build](https://img.shields.io/github/actions/workflow/status/Maciejonos/qbitwebui/docker.yml?style=for-the-badge&labelColor=101418&color=4EB329&label=build)](https://github.com/Maciejonos/qbitwebui/actions)
</div>

<div align="center">
<img width="800" alt="main" src="https://github.com/user-attachments/assets/64ae19ea-9029-442c-97dd-958af04e21d1" />
<img width="800" alt="torrents-view" src="https://github.com/user-attachments/assets/f0be4014-8ca5-4ac5-b3be-b0b75a0e2df8" />

</div>

<details>
<summary><h3>Themes</h3></summary>
<div align="center">
<img width="800" height="1730" alt="theme-catppuccin" src="https://github.com/user-attachments/assets/2982522e-789d-400b-9a9f-08f9277fb491" />
<img width="800" height="1730" alt="theme-gruvbox" src="https://github.com/user-attachments/assets/e8dce4d7-c9f5-41dc-af91-b6d8683ae50f" />
<img width="800" height="1730" alt="theme-dracula" src="https://github.com/user-attachments/assets/a0c52d40-c960-48dd-93c2-76f194612150" />
<img width="800" height="1730" alt="theme-nord" src="https://github.com/user-attachments/assets/e5960f2a-fd01-4656-b9e0-c72a4af0b328" />
</div>
</details>

<details>
<summary><h3>Mobile UI (PWA)</h3></summary>
<div align="center">
<table>
  <tr>
   <td> <img width="295" alt="mobile" src="https://github.com/user-attachments/assets/ea14587c-1b12-46c7-afdc-def83b5e3e7c" /></td>
   <td> <img width="295" alt="mobile-detailed" src="https://github.com/user-attachments/assets/97c1ddf1-8df0-4acd-a6a1-5690badd7aa7" /></td>
  </tr>
</table>
</div>
</details>

## Features

- **Multi-instance** - Manage multiple qBittorrent instances from one dashboard
- **Instance speed management** - Easily control global/alternative speed limits per instance
- **Instance statistics** - Overview of all instances with status, speeds, torrent counts
- **User accounts** - Register/login with secure session management
- **Prowlarr integration** - Search indexers and send torrents directly to qBittorrent
- **Real-time monitoring** - Auto-refresh torrent status, speeds, progress
- **Customizable columns** - Show/hide columns, drag and drop reorder
- **Torrent management** - Add via magnet/file, set priorities, manage trackers/peers
- **Organization** - Filter by status, category, tag, or tracker
- **Bulk actions** - Multi-select with context menu, keyboard navigation
- **Themes** - Multiple color themes included
- **Encrypted storage** - qBittorrent credentials stored with AES-256-GCM
- **File browser** - Browse and download files from your downloads directory
- **RSS management** - Define rules, add RSS feeds, manage folders

## Docker

```yaml
services:
  qbitwebui:
    image: ghcr.io/maciejonos/qbitwebui:latest
    ports:
      - "3000:3000"
    environment:
      # Generate your own: openssl rand -hex 32
      - ENCRYPTION_KEY=your-secret-key-here
      # Uncomment to disable login (single-user mode)
      # - DISABLE_AUTH=true
      # Uncomment to disable registration (creates default admin account)
      # - DISABLE_REGISTRATION=true
      # Uncomment to allow HTTPS with self-signed certificates
      # - ALLOW_SELF_SIGNED_CERTS=true
      # Uncomment to enable file browser
      # - DOWNLOADS_PATH=/downloads
    volumes:
      - ./data:/data
      # Uncomment to enable file browser (read-only: browse & download only)
      # - /path/to/your/downloads:/downloads:ro
      # Or mount read-write to enable delete/move/copy/rename
      # - /path/to/your/downloads:/downloads
    restart: unless-stopped
```

Or build locally:

```bash
docker compose up -d
```

## Development

```bash
export ENCRYPTION_KEY=$(openssl rand -hex 32)

bun install
bun run dev
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | - | Min 32 chars, used to encrypt stored credentials |
| `PORT` | No | `3000` | Server port |
| `DATABASE_PATH` | No | `./data/qbitwebui.db` | SQLite database location |
| `SALT_PATH` | No | `./data/.salt` | Encryption salt file location |
| `ALLOW_SELF_SIGNED_CERTS` | No | `false` | Set to `true` to allow HTTPS connections to qBittorrent instances with self-signed certificates |
| `DISABLE_AUTH` | No | `false` | Set to `true` to disable login/registration (guest mode) |
| `DISABLE_REGISTRATION` | No | `false` | Set to `true` to disable new registrations. Creates default `admin` account on first run (password shown in logs) |
| `DOWNLOADS_PATH` | No | - | Path to downloads directory to enable file browser |

## Tech Stack

React 19, TypeScript, Tailwind CSS v4, Vite, TanStack Query, Hono, SQLite, Bun

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Maciejonos/qbitwebui&type=date&legend=top-left)](https://www.star-history.com/#Maciejonos/qbitwebui&type=date&legend=top-left)

## License

MIT
