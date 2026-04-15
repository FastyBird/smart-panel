# Task: Backup and Restore

ID: FEATURE-BACKUP-RESTORE
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to protect my Smart Panel configuration and data against hardware failure, SD card corruption, or failed updates,
As a system administrator,
I want to create backups of the system, download them, and restore from them when needed.

## 2. Context

- Smart Panel stores all data in a SQLite database and YAML config files.
- There is currently no backup mechanism — if the SD card fails, all configuration is lost.
- Home Assistant offers a similar feature: create backup, download as tar.gz, upload to restore.
- The update mechanism already has a status tracking pattern that can be reused for backup progress.
- The system module already has commands for system operations (reboot, update).

### What to back up

| Data | Path | Contents |
|------|------|----------|
| SQLite database | FB_DB_PATH/database.sqlite | Users, devices, channels, properties, scenes, dashboard, displays, extensions, tokens |
| Config files | FB_CONFIG_PATH/*.yaml | Plugin configs, module configs (weather locations, storage settings, etc.) |
| Buddy personality | var/buddy/personality.md | Custom AI personality |
| Buddy auth files | var/buddy/whatsapp-auth/ | WhatsApp session data |
| Environment | /etc/smart-panel/environment | JWT secret, port, DB path, config path |

### What NOT to back up

- InfluxDB historical data (too large, separate backup mechanism)
- Node modules / application code (reinstalled during restore)
- Systemd service files (recreated during install)
- Display panel app data (stored on display devices)

## 3. Scope

**In scope**

### Backend

- New BackupService in the system module
- POST /modules/system/backups — create a new backup (returns backup metadata)
- GET /modules/system/backups — list available backups
- GET /modules/system/backups/:id/download — download backup as tar.gz
- POST /modules/system/backups/upload — upload a backup file
- POST /modules/system/backups/:id/restore — restore from a backup (restarts service)
- DELETE /modules/system/backups/:id — delete a backup
- Backup file format: tar.gz containing database, config files, and metadata JSON
- Backup metadata: id, name, version, createdAt, size, description
- Store backups in FB_DATA_DIR/backups/
- Auto-create backup before updates (integrate with update executor)
- Limit stored backups (configurable, default 5)

### Admin UI

- New "Backups" section in System settings
- List of backups with: name, date, size, version, download/restore/delete buttons
- "Create Backup" button with optional name/description
- "Upload Backup" button for restoring from external backup
- Restore confirmation dialog with warning
- Progress indicator during backup creation and restore

**Out of scope**

- Scheduled/automatic backups (manual trigger only for v1)
- Cloud backup storage
- Partial restore (all-or-nothing)
- InfluxDB backup/restore
- Encryption of backup files

## 4. Acceptance criteria

### Backend

- [ ] POST /modules/system/backups creates a tar.gz backup with database + config + metadata
- [ ] Backup includes: database.sqlite, config/*.yaml, buddy/personality.md, metadata.json
- [ ] Backup metadata contains: id, name, version, createdAt, sizeBytes
- [ ] GET /modules/system/backups returns list of available backups sorted by date
- [ ] GET /modules/system/backups/:id/download streams the backup file
- [ ] POST /modules/system/backups/upload accepts a tar.gz file upload
- [ ] POST /modules/system/backups/:id/restore stops service, replaces database + config, restarts
- [ ] DELETE /modules/system/backups/:id removes the backup file
- [ ] Database is copied (not moved) during backup to avoid locking issues
- [ ] Restore validates the backup metadata (version compatibility check)
- [ ] Old backups are automatically cleaned up when limit is exceeded
- [ ] Endpoints require OWNER or ADMIN role
- [ ] Unit tests for backup creation, listing, and metadata parsing

### Admin UI

- [ ] System settings shows "Backups" section with backup list
- [ ] "Create Backup" opens dialog with optional name field
- [ ] Backup list shows name, date, version, size with download/restore/delete actions
- [ ] Download triggers browser file download
- [ ] Restore shows confirmation dialog with warning about data replacement
- [ ] Upload accepts .tar.gz files
- [ ] No regressions in existing system settings

## 5. Example scenarios

### Scenario: Create and download a backup

Given the admin is on the System backups page
When they click "Create Backup" and enter name "Before update"
Then a backup is created containing the database and config
And it appears in the list with size and creation date
When they click "Download"
Then the browser downloads the backup tar.gz file

### Scenario: Restore from backup

Given the admin uploads a backup file from another device
When they click "Restore" and confirm
Then the system stops, replaces the database and config
And restarts with the restored data
And all devices, scenes, and settings are from the backup

### Scenario: Pre-update backup

Given an update is available
When the admin triggers the update
Then a backup is automatically created before the update starts
And if the update fails, the admin can restore from the backup

## 6. Technical constraints

- Use execFile (not exec) for tar operations to prevent command injection
- SQLite backup: use file copy while database is in WAL mode
- Config files: copy the entire config directory
- Metadata JSON format with: id, name, version, createdAt, sizeBytes, description, contents array
- File upload: use fastify/multipart plugin (check if already installed)
- Backup directory: FB_DATA_DIR/backups/ with 0700 permissions
- Max backup size: warn if database exceeds 100MB
- Restore must handle version differences gracefully (run migrations after restore)
- Follow existing controller and service patterns in the system module
- Swagger decorators on all endpoints
- Role guards: OWNER and ADMIN only

## 7. Implementation hints

### Backup creation flow

1. Generate UUID for backup
2. Create temp directory
3. Copy database.sqlite (file copy, not SQLite backup command)
4. Copy config directory recursively
5. Copy buddy files if they exist
6. Write metadata.json
7. Create tar.gz using execFile('tar', ['-czf', ...])
8. Move tar.gz to backups directory
9. Cleanup temp directory
10. Return metadata

### Restore flow

1. Extract backup to temp directory
2. Read and validate metadata.json (version check)
3. Stop service via process.exit(0) with Restart=always
4. Before exit: replace database file, replace config files
5. Service restarts automatically via systemd
6. Migrations run on startup if needed

### Admin UI

Follow the existing system settings pattern. Use ElTable for backup list. ElUpload for file upload. Direct link with auth header for download.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Implement backend first, then admin UI.
- Use the system module as the location for backup service and controller.
- Follow existing patterns for file operations.
- Use execFile (not exec) for shell commands to prevent injection.
- The restore operation is destructive — add proper confirmation and error handling.
- Keep the backup format simple (tar.gz with flat structure).
- Respect global AI rules from GUIDELINES.md.
