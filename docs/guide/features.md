# Features

## Multi-Instance Dashboard

Manage multiple qBittorrent instances from one interface:

- Overview cards showing status, speeds, and torrent counts
- Aggregate statistics across all instances
- Quick switching between instances
- Connection testing and version display

### Instance Options

| Option | Description |
|--------|-------------|
| Skip Authentication | Use when qBittorrent has IP bypass enabled |
| Enable Network Agent | Connect to net-agent for diagnostics |

## Torrent Management

### List View

- Sortable columns (name, size, progress, speed, ratio, etc.)
- Filter by status: All, Downloading, Seeding, Completed, Paused, Active, Inactive, Stalled, Checking, Error
- Filter by category, tag, or tracker
- Search by torrent name
- Customizable columns with drag-to-reorder
- Resizable column widths (persisted)

### Actions

| Action | Description |
|--------|-------------|
| Start/Stop | Resume or pause torrents |
| Recheck | Verify torrent data integrity |
| Reannounce | Force tracker announce |
| Delete | Remove torrent, optionally with files |
| Rename | Change torrent name |
| Export | Download .torrent file |
| Set Category | Assign to a category |
| Add/Remove Tags | Manage torrent tags |

### Details Panel

Expandable panel showing:

- **General**: Size, progress, ratio, ETA, speeds, seeds/peers, dates, save path
- **Trackers**: List with status, add/remove trackers
- **Peers**: Connected peers with client, flags, progress, speeds
- **Files**: File tree with individual progress and priority control
- **HTTP Sources**: Web seed URLs

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate between torrents |
| `Ctrl+A` | Select all torrents |
| `Escape` | Clear selection |

### Context Menu

Right-click any torrent for quick actions including category/tag submenus.

## Custom Views

Save your current filter and column setup:

1. Configure filters, columns, and sort order
2. Click the view selector → Save View
3. Name your view
4. Switch between saved views instantly

## Categories & Tags

### Categories

- Create categories with optional custom save paths
- Edit save paths for existing categories
- Delete categories
- Assign via context menu or details panel

### Tags

- Create and delete tags
- Add/remove tags from torrents
- Filter torrents by tag

## Prowlarr Integration

Search across all your indexers without leaving qbitwebui.

### Setup

1. Go to any instance → Settings icon → Integrations tab
2. Click **Add Prowlarr**
3. Enter Prowlarr URL and API key
4. Test connection and save

### Searching

1. Click the search icon in the header
2. Enter search query
3. Filter by indexer or category
4. View results with seeders, size, age, freeleech status
5. Click grab → select instance → optionally set category/path → confirm

## RSS Manager

Manage RSS feeds and auto-download rules.

### Feeds

- Add feeds by URL
- Organize in folders
- Refresh feeds manually
- View articles with grab option

### Auto-Download Rules

- Create rules with name patterns (regex supported)
- Filter by category, episode, season
- Set target category and save path
- Preview matching articles

## File Browser

Browse and manage downloaded files (requires `DOWNLOADS_PATH`).

### Operations

| Operation | Description |
|-----------|-------------|
| Browse | Navigate directories |
| Download | Download files or folders (as tar) |
| Delete | Remove files/directories |
| Move | Move to another location |
| Copy | Copy to another location |
| Rename | Rename file or directory |

## Cross-Seed (Experimental)

Find cross-seeding opportunities using Prowlarr indexers.

### How It Works

1. Configure Prowlarr integration
2. Select which indexers to search
3. Run scan on your torrents
4. Review matches (size, name similarity)
5. Add matches to start cross-seeding

### Options

- Match mode: Strict or Flexible
- Dry run: Preview without adding
- Category suffix for cross-seeded torrents
- Blocklist for excluding certain releases

## Orphan Manager

Detect and clean up problematic torrents.

### Detects

- Torrents with missing files on disk
- Torrents with unregistered tracker status

### Actions

- Scan all instances at once
- Bulk select orphans
- Delete with or without files

## Statistics

View transfer history with multiple time periods:

- 15 minutes, 30 minutes, 1 hour
- 4 hours, 12 hours, 24 hours
- 7 days, 30 days, all-time

Toggle between per-instance and aggregate views.

## Log Viewer

View qBittorrent logs in real-time.

### Application Logs

Filter by level:
- Normal
- Info
- Warning
- Critical

### Peer Logs

Connection events with IP, client, and direction.

Auto-refresh available for both.

## Settings Panel

Edit qBittorrent preferences directly.

### Tabs

| Tab | Settings |
|-----|----------|
| Behavior | Language, startup, power management |
| Downloads | Save paths, pre-allocation, torrent handling |
| Connection | Ports, protocols, proxy |
| Speed | Global/per-torrent limits, scheduling |
| BitTorrent | DHT, PeX, encryption, queueing |
| RSS | Auto-download, refresh interval |
| WebUI | Address, auth, HTTPS, custom UI |
| Advanced | Memory, disk cache, network options |

Only changed values are saved.

## Themes

### Built-in Themes

Multiple themes available including Dark, Light, Catppuccin variants, Nord, and more.

### Custom Themes

Create your own theme with the theme editor:

- Background colors (primary, secondary, tertiary)
- Text colors (primary, secondary, muted)
- Accent color
- Border colors
- Status colors (success, warning, error)

Themes are saved in browser localStorage.

## Mobile Support

Fully responsive with dedicated mobile interface:

- Touch-optimized torrent list
- Swipe actions
- Mobile-specific navigation
- All features accessible
