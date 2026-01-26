# Configuration

All configuration is done through environment variables.

## Required

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_KEY` | AES-256 key for encrypting stored credentials. Minimum 32 characters. |

Generate a key:
```bash
openssl rand -hex 32
```

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DATABASE_PATH` | `./data/qbitwebui.db` | SQLite database location |
| `SALT_PATH` | `./data/.salt` | Encryption salt file location |

## Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_AUTH` | `false` | Skip authentication entirely |
| `DISABLE_REGISTRATION` | `false` | Prevent new user signups |

### Disable Auth

Use when running behind an authenticating reverse proxy (Authelia, Authentik, etc.):

```yaml
environment:
  - DISABLE_AUTH=true
```

::: danger
Only use behind a properly secured reverse proxy. Anyone who can reach qbitwebui will have full access.
:::

### Disable Registration

Lock down to existing users only. On first start with no users, generates a random admin password printed to logs:

```yaml
environment:
  - DISABLE_REGISTRATION=true
```

## Features

| Variable | Default | Description |
|----------|---------|-------------|
| `DOWNLOADS_PATH` | - | Enable file browser at this path |
| `ALLOW_SELF_SIGNED_CERTS` | `false` | Accept self-signed TLS certificates |

### File Browser

Mount your downloads directory and set the path:

```yaml
environment:
  - DOWNLOADS_PATH=/downloads
volumes:
  - /path/to/downloads:/downloads:ro
```

The `:ro` makes it read-only. Remove for write access (delete, move, rename).

### Self-Signed Certificates

If your qBittorrent uses HTTPS with a self-signed certificate:

```yaml
environment:
  - ALLOW_SELF_SIGNED_CERTS=true
```

## Database

SQLite database stores:

| Data | Security |
|------|----------|
| Users | Passwords hashed with bcrypt (cost 12) |
| Sessions | Random tokens, 7-day expiry |
| Instances | Credentials encrypted with AES-256-GCM |
| Integrations | API keys encrypted with AES-256-GCM |

### Backup

```bash
cp ./data/qbitwebui.db ./backup/
```

### Restore

```bash
cp ./backup/qbitwebui.db ./data/
```

Use the same `ENCRYPTION_KEY` after restore.
