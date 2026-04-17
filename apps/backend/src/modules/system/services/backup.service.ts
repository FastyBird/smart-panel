import { execFile } from 'child_process';
import {
	copyFileSync,
	cpSync,
	existsSync,
	linkSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { DataSource } from 'typeorm';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { BackupContributionRegistry } from './backup-contribution-registry.service';

const execFileAsync = promisify(execFile);

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../../../../../package.json'), 'utf-8')) as {
	version: string;
};

const MAX_BACKUPS = 5;

/**
 * Thrown by archive validation helpers when an archive is structurally invalid
 * (traversal entries, symlinks, inconsistent listings). Callers that swallow
 * generic extraction errors should still propagate these — they indicate a
 * malicious or corrupt backup the user needs to see.
 */
export class BackupArchiveError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupArchiveError';
	}
}

export interface BackupMetadata {
	id: string;
	name: string;
	version: string;
	createdAt: string;
	sizeBytes: number;
	contributions: { source: string; label: string; type: string }[];
}

@Injectable()
export class BackupService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'BackupService');

	private readonly dbPath: string;
	private readonly backupsDir: string;

	constructor(
		private readonly configService: NestConfigService,
		private readonly contributionRegistry: BackupContributionRegistry,
		@InjectDataSource() private readonly dataSource: DataSource,
	) {
		const dbDir = getEnvValue<string>(this.configService, 'FB_DB_PATH', resolve(__dirname, '../../../../../../var/db'));

		this.dbPath = join(dbDir, 'database.sqlite');

		const dataDir = getEnvValue<string>(this.configService, 'FB_DATA_DIR', '/var/lib/smart-panel');

		this.backupsDir = join(dataDir, 'backups');
	}

	/**
	 * Ensure the backups directory exists. Called lazily on first use
	 * rather than in the constructor to avoid EACCES in CI/test environments.
	 */
	private ensureBackupsDir(): void {
		if (!existsSync(this.backupsDir)) {
			mkdirSync(this.backupsDir, { recursive: true });

			this.logger.debug(`Created backups directory: ${this.backupsDir}`);
		}
	}

	async create(name?: string): Promise<BackupMetadata> {
		this.ensureBackupsDir();

		const id = uuid();
		const backupName = name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
		const tempDir = join(this.backupsDir, `temp-${id}`);
		const tarPath = join(this.backupsDir, `${id}.tar.gz`);

		this.logger.debug(`Creating backup id=${id} name=${backupName}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Snapshot the live SQLite file via the `sqlite3` CLI's .backup command so
			// concurrent writes don't corrupt the copy. copyFileSync races the WAL and is
			// only safe as a fallback when the CLI isn't installed.
			if (existsSync(this.dbPath)) {
				const backupDbPath = join(tempDir, 'database.sqlite');

				try {
					await execFileAsync('sqlite3', [this.dbPath, `.backup '${backupDbPath}'`]);
				} catch (error) {
					const err = error as NodeJS.ErrnoException;

					// Only fall back on spawn failures (CLI missing) — any other error
					// (DB lock, permission denied, disk full) means the snapshot is unsafe
					// and must propagate instead of being masked by the racy file copy.
					if (err.code !== 'ENOENT') {
						throw error;
					}

					this.logger.warn('sqlite3 CLI not found — falling back to copyFileSync (unsafe under concurrent writes)');

					copyFileSync(this.dbPath, backupDbPath);
				}

				this.logger.debug('Database snapshot created for backup');
			} else {
				this.logger.warn(`Database file not found at ${this.dbPath}, skipping`);
			}

			// Copy contributions
			const contributions = this.contributionRegistry.getContributions();
			const includedContributions: { source: string; label: string; type: string }[] = [];

			for (const contribution of contributions) {
				if (!existsSync(contribution.path)) {
					if (contribution.optional) {
						this.logger.debug(`Optional contribution not found, skipping: ${contribution.path}`);

						continue;
					}

					// Fail the backup — silently skipping a required contribution would produce
					// an archive that looks successful but is missing data the caller declared
					// mandatory (e.g. the config directory), leading to a broken restore later
					throw new Error(
						`Required backup contribution is missing: ${contribution.label} (${contribution.source}) at ${contribution.path}`,
					);
				}

				// Use source + label as the archive path so a module that registers
				// multiple contributions doesn't have them collide in the same directory
				const safeSource = contribution.source.replace(/[^a-zA-Z0-9_-]/g, '_');
				const safeLabel = (contribution.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
				const contributionDir = join(tempDir, 'contributions', safeSource, safeLabel);

				mkdirSync(contributionDir, { recursive: true });

				if (contribution.type === 'file') {
					const fileName = (contribution.path.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

					copyFileSync(contribution.path, join(contributionDir, fileName));
				} else {
					const dirName = (contribution.path.split('/').pop() || 'dir').replace(/[^a-zA-Z0-9._-]/g, '_');

					cpSync(contribution.path, join(contributionDir, dirName), {
						recursive: true,
					});
				}

				includedContributions.push({
					source: contribution.source,
					label: contribution.label,
					type: contribution.type,
				});

				this.logger.debug(`Copied contribution: ${contribution.label} from ${contribution.source}`);
			}

			// Write metadata
			const metadata: Omit<BackupMetadata, 'sizeBytes'> = {
				id,
				name: backupName,
				version: packageJson.version,
				createdAt: new Date().toISOString(),
				contributions: includedContributions,
			};

			writeFileSync(join(tempDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

			// Create tar.gz archive
			await execFileAsync('tar', ['-czf', tarPath, '-C', tempDir, '.']);

			// Calculate file size
			const stats = statSync(tarPath);

			// Cleanup temp dir
			rmSync(tempDir, { recursive: true, force: true });

			// Write metadata sidecar so list() can skip tar extraction
			this.writeMetadataSidecar(id, metadata);

			// Cleanup old backups (preserve the one we just created)
			await this.cleanupOldBackups(id);

			const fullMetadata: BackupMetadata = {
				...metadata,
				sizeBytes: stats.size,
			};

			this.logger.log(`Backup created successfully: id=${id}, size=${stats.size} bytes`);

			return fullMetadata;
		} catch (error) {
			// Cleanup on failure
			rmSync(tempDir, { recursive: true, force: true });

			if (existsSync(tarPath)) {
				rmSync(tarPath, { force: true });
			}

			throw error;
		}
	}

	async list(): Promise<BackupMetadata[]> {
		if (!existsSync(this.backupsDir)) {
			return [];
		}

		// Only list backup files, not temp upload files
		const files = readdirSync(this.backupsDir).filter((f) => f.endsWith('.tar.gz') && !f.startsWith('upload-'));
		const backups: BackupMetadata[] = [];

		for (const file of files) {
			const id = file.replace('.tar.gz', '');

			try {
				const metadata = await this.getMetadata(id);

				if (metadata) {
					backups.push(metadata);
				}
			} catch (error) {
				this.logger.warn(`Failed to read metadata from backup ${file}`, { error });
			}
		}

		// Sort by creation date, newest first. Fall back to 0 for unparsable timestamps —
		// saveUploadedBackup validates createdAt, but legacy archives or a corrupted
		// sidecar could still reach this path, and NaN comparisons are never true which
		// would leave the ordering undefined.
		backups.sort((a, b) => this.getCreatedAtMs(b.createdAt) - this.getCreatedAtMs(a.createdAt));

		return backups;
	}

	private getCreatedAtMs(createdAt: string): number {
		const ms = new Date(createdAt).getTime();

		return Number.isFinite(ms) ? ms : 0;
	}

	getBackupPath(id: string): string {
		return join(this.backupsDir, `${id}.tar.gz`);
	}

	delete(id: string): void {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			throw new Error(`Backup not found: ${id}`);
		}

		rmSync(tarPath, { force: true });

		const sidecarPath = this.getMetadataSidecarPath(id);

		if (existsSync(sidecarPath)) {
			rmSync(sidecarPath, { force: true });
		}

		this.logger.log(`Backup deleted: id=${id}`);
	}

	async restore(id: string): Promise<void> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			throw new Error(`Backup not found: ${id}`);
		}

		const tempDir = join(this.backupsDir, `restore-${id}`);

		this.logger.log(`Restoring backup id=${id}`);

		// Flips once we start mutating live host state (contribution files or the
		// DataSource). Past this point the app's on-disk state is partially replaced,
		// so any failure must exit the process — propagating to the caller would leave
		// a broken app serving requests against a half-restored filesystem or DB.
		let pointOfNoReturn = false;

		try {
			mkdirSync(tempDir, { recursive: true });

			// Pin the archive to a private path inside tempDir so a concurrent rename
			// or rewrite of the public tarPath between our listing and extraction can't
			// swap in a malicious archive after our safety checks. A hardlink keeps the
			// original inode alive even if the public name is replaced; fall back to a
			// full copy on cross-filesystem errors.
			const workingArchive = join(tempDir, 'archive.tar.gz');

			try {
				linkSync(tarPath, workingArchive);
			} catch (error) {
				const err = error as NodeJS.ErrnoException;

				// Only fall back on cross-filesystem link failure. Other errors (EACCES,
				// ENOSPC, ENOENT race) would just fail the copy the same way with a more
				// confusing secondary error — surface the original instead.
				if (err.code !== 'EXDEV') {
					throw error;
				}

				copyFileSync(tarPath, workingArchive);
			}

			await this.validateArchiveSafety(workingArchive);

			await execFileAsync('tar', ['--no-same-owner', '--no-same-permissions', '-xzf', workingArchive, '-C', tempDir]);

			// Validate metadata
			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new Error('Invalid backup: metadata.json not found');
			}

			const metadata = JSON.parse(this.readExtractedFileSafely(metadataPath)) as BackupMetadata;

			if (!metadata.id || !metadata.version) {
				throw new Error('Invalid backup: metadata is missing required fields');
			}

			// Restore contributions FIRST — overwriting the DB while the app is still
			// running with open connections can let SQLite recreate a WAL from its cached
			// view of the OLD database, which would then replay onto the restored file
			// after restart and corrupt it. Do the file-only work here; the DB swap
			// happens last, after the DataSource is closed.
			if (metadata.contributions && metadata.contributions.length > 0) {
				const registeredContributions = this.contributionRegistry.getContributions();
				const contributionKey = (source: string, label: string): string => `${source}\u0000${label}`;
				const registeredByKey = new Map(
					registeredContributions.map((c) => [contributionKey(c.source, c.label), c] as const),
				);

				for (const contribution of metadata.contributions) {
					// Match by (source, label), not absolute path — paths differ between machines
					const registered = registeredByKey.get(contributionKey(contribution.source, contribution.label));

					if (!registered) {
						this.logger.warn(`Skipping unregistered contribution: ${contribution.source} (${contribution.label})`);

						continue;
					}

					const safeSource = contribution.source.replace(/[^a-zA-Z0-9_-]/g, '_');
					const safeLabel = (contribution.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
					const contributionDir = join(tempDir, 'contributions', safeSource, safeLabel);

					// Metadata claimed a contribution the archive doesn't actually hold — the
					// archive is corrupt. Throwing is safer than continuing: if the DB swap is
					// still ahead, PNR isn't set yet and the restore aborts cleanly; if a prior
					// iteration already flipped PNR, the catch handler exits for restart.
					if (!existsSync(contributionDir)) {
						throw new Error(`Invalid backup: contribution ${contribution.label} not present in archive`);
					}

					const entries = readdirSync(contributionDir);

					// Each contribution dir must hold exactly one entry (file or directory) — a
					// different count means the archive layout is corrupt or tampered with
					if (entries.length !== 1) {
						throw new Error(
							`Invalid backup: contribution ${contribution.label} has unexpected archive layout (${entries.length} entries)`,
						);
					}

					const sourcePath = join(contributionDir, entries[0]);

					// Restore to the currently registered path, not the path from the backup
					const targetPath = registered.path;
					const targetDir = resolve(targetPath, '..');

					if (!existsSync(targetDir)) {
						mkdirSync(targetDir, { recursive: true });
					}

					// About to mutate a live host path — from this point any failure (mid-loop
					// crash, disk full, permission error) leaves the filesystem in a half-
					// restored state with some contributions swapped and others untouched, and
					// a directory contribution's original tree already deleted. The app cannot
					// keep serving in that state, so treat further errors as fatal and exit.
					pointOfNoReturn = true;

					// Trust the registry's type (same as path): the currently installed system
					// defines what this contribution should look like, not the untrusted archive
					if (registered.type === 'directory') {
						// Remove the existing target before copying so files created after the
						// backup are cleared — cpSync merges rather than replacing, which would
						// otherwise leave stale state that can conflict with the restored DB
						if (existsSync(targetPath)) {
							rmSync(targetPath, { recursive: true, force: true });
						}

						cpSync(sourcePath, targetPath, { recursive: true });
					} else {
						copyFileSync(sourcePath, targetPath);
					}

					this.logger.debug(`Restored contribution: ${contribution.label} to ${targetPath}`);
				}
			}

			// Restore database LAST, after contributions are in place. Close the DataSource
			// first so SQLite flushes its WAL and releases file handles — otherwise the
			// running engine could rewrite WAL/SHM between our file swap and process.exit,
			// and those stale entries would replay onto the restored DB at next boot.
			const backupDbPath = join(tempDir, 'database.sqlite');

			if (existsSync(backupDbPath)) {
				if (this.dataSource.isInitialized) {
					pointOfNoReturn = true;

					// Let destroy errors propagate — the header comment above this block
					// explains why a clean close is the WAL-consistency guarantee. If it
					// fails we must not copy over the DB; PNR is set, so the catch handler
					// will process.exit(1) and systemd will restart into a clean state.
					await this.dataSource.destroy();
				}

				const dbDir = resolve(this.dbPath, '..');

				if (!existsSync(dbDir)) {
					mkdirSync(dbDir, { recursive: true });
				}

				copyFileSync(backupDbPath, this.dbPath);

				// Remove any residual WAL/SHM left by the closed connection so SQLite
				// reopens from a clean state on restart
				const walPath = `${this.dbPath}-wal`;
				const shmPath = `${this.dbPath}-shm`;

				if (existsSync(walPath)) {
					rmSync(walPath, { force: true });
				}

				if (existsSync(shmPath)) {
					rmSync(shmPath, { force: true });
				}

				this.logger.log('Database restored from backup');
			}

			// Cleanup temp dir
			rmSync(tempDir, { recursive: true, force: true });

			this.logger.log(`Backup restored successfully: id=${id}. Exiting process for restart.`);

			// Exit process - systemd will restart, migrations run on boot
			process.exit(0);
		} catch (error) {
			// Cleanup on failure
			rmSync(tempDir, { recursive: true, force: true });

			if (pointOfNoReturn) {
				// Live host state is already partially mutated (contributions overwritten
				// and/or DataSource destroyed). Continuing would keep a broken app alive
				// against a half-restored filesystem/DB. Exit non-zero so systemd restarts
				// into a clean state; the user can inspect the partial state and retry.
				this.logger.error(
					`Backup restore failed after mutating live state: ${(error as Error).message}. Exiting for restart.`,
					(error as Error).stack,
				);

				process.exit(1);
			}

			throw error;
		}
	}

	async getMetadata(id: string): Promise<BackupMetadata | null> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			return null;
		}

		const stats = statSync(tarPath);

		// Fast path: read the sidecar written next to the archive on create/upload
		const sidecar = this.readMetadataSidecar(id);

		if (sidecar) {
			return { ...sidecar, sizeBytes: stats.size };
		}

		// Fallback: extract metadata.json from the tar (e.g. legacy archives without a sidecar).
		// Cache the result as a sidecar so subsequent reads skip the tar subprocess.
		const tempDir = join(this.backupsDir, `meta-${id}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			await this.validateArchiveSafety(tarPath);

			await execFileAsync('tar', [
				'--no-same-owner',
				'--no-same-permissions',
				'-xzf',
				tarPath,
				'-C',
				tempDir,
				'./metadata.json',
			]);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				rmSync(tempDir, { recursive: true, force: true });

				return null;
			}

			const metadata = JSON.parse(this.readExtractedFileSafely(metadataPath)) as Omit<BackupMetadata, 'sizeBytes'>;

			rmSync(tempDir, { recursive: true, force: true });

			// Sidecar caching is best-effort here — on create/upload it must succeed, but
			// for this fallback path the caller only needs the metadata we already parsed
			try {
				this.writeMetadataSidecar(id, metadata);
			} catch (error) {
				this.logger.warn(`Failed to cache metadata sidecar for backup ${id}`, { error });
			}

			return {
				...metadata,
				sizeBytes: stats.size,
			};
		} catch (error) {
			rmSync(tempDir, { recursive: true, force: true });

			// Propagate archive-integrity/security errors — a malicious archive silently
			// returning null would hide it from list() and the UI. Swallow ephemeral
			// problems (tar extraction, JSON parse, missing metadata.json) as null so a
			// transiently unreadable backup doesn't 500 delete/restore endpoints.
			if (error instanceof BackupArchiveError) {
				throw error;
			}

			this.logger.warn(`Failed to extract metadata from backup ${id}`, { error });

			return null;
		}
	}

	// Verify an archive contains only regular files and directories with safe paths.
	// Rejects symlinks/hardlinks and `..`/absolute paths before any extraction — a
	// crafted archive could otherwise point metadata.json at an arbitrary host path
	// (e.g. /etc/passwd) and have a later readFileSync leak its contents.
	private async validateArchiveSafety(archivePath: string): Promise<void> {
		const [{ stdout: tarPaths }, { stdout: tarVerbose }] = await Promise.all([
			execFileAsync('tar', ['-tzf', archivePath]),
			execFileAsync('tar', ['-tvzf', archivePath]),
		]);

		const paths = tarPaths.split('\n').filter((line) => line.length > 0);
		const verboseLines = tarVerbose.split('\n').filter((line) => line.length > 0);

		if (paths.length !== verboseLines.length) {
			throw new BackupArchiveError('Invalid backup: archive listing is inconsistent');
		}

		for (let i = 0; i < paths.length; i++) {
			const entryPath = paths[i];

			if (entryPath.startsWith('/') || entryPath.split('/').some((segment) => segment === '..')) {
				throw new BackupArchiveError('Invalid backup: archive contains path traversal entries');
			}

			const fileType = verboseLines[i][0];

			if (fileType !== '-' && fileType !== 'd') {
				throw new BackupArchiveError(`Invalid backup: archive contains disallowed entry type "${fileType}"`);
			}
		}
	}

	// Defense in depth: even after validateArchiveSafety, refuse to read an extracted
	// file that turns out to be a symlink. readFileSync would otherwise follow it.
	private readExtractedFileSafely(filePath: string): string {
		if (lstatSync(filePath).isSymbolicLink()) {
			throw new BackupArchiveError('Invalid backup archive: extracted entry is a symlink');
		}

		return readFileSync(filePath, 'utf-8');
	}

	private getMetadataSidecarPath(id: string): string {
		return join(this.backupsDir, `${id}.json`);
	}

	private writeMetadataSidecar(id: string, metadata: Omit<BackupMetadata, 'sizeBytes'>): void {
		// Throws to the caller — without the sidecar, list() falls back to tar extraction
		// which also catches-and-returns-null, so a silent failure here would make the
		// just-saved backup invisible in the UI and unmanageable through the API.
		writeFileSync(this.getMetadataSidecarPath(id), JSON.stringify(metadata, null, 2));
	}

	private readMetadataSidecar(id: string): Omit<BackupMetadata, 'sizeBytes'> | null {
		const sidecarPath = this.getMetadataSidecarPath(id);

		if (!existsSync(sidecarPath)) {
			return null;
		}

		try {
			return JSON.parse(readFileSync(sidecarPath, 'utf-8')) as Omit<BackupMetadata, 'sizeBytes'>;
		} catch (error) {
			this.logger.warn(`Failed to read metadata sidecar for backup ${id}`, { error });

			return null;
		}
	}

	async saveUploadedBackup(buffer: Buffer, _originalFilename?: string): Promise<BackupMetadata> {
		this.ensureBackupsDir();

		const tempId = uuid();
		const tempTarPath = join(this.backupsDir, `upload-${tempId}.tar.gz`);
		const tempDir = join(this.backupsDir, `upload-meta-${tempId}`);
		let finalPath: string | null = null;

		try {
			// Save uploaded file
			writeFileSync(tempTarPath, buffer);

			// Extract metadata to validate
			mkdirSync(tempDir, { recursive: true });

			// Validate entry types/paths before any extraction — an archive whose
			// metadata.json is a symlink pointing at an arbitrary host file would
			// otherwise cause the readFileSync below to leak that file's contents.
			await this.validateArchiveSafety(tempTarPath);

			await execFileAsync('tar', [
				'--no-same-owner',
				'--no-same-permissions',
				'-xzf',
				tempTarPath,
				'-C',
				tempDir,
				'./metadata.json',
			]);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new Error('Invalid backup archive: metadata.json not found');
			}

			const metadata = JSON.parse(this.readExtractedFileSafely(metadataPath)) as Omit<BackupMetadata, 'sizeBytes'>;

			if (!metadata.id || !metadata.version || !metadata.createdAt) {
				throw new Error('Invalid backup archive: metadata is missing required fields');
			}

			// createdAt must parse to a finite timestamp — cleanupOldBackups and list()
			// sort by Date.getTime(), and NaN comparisons are never true, which would
			// silently corrupt retention ordering and risk deleting the wrong backups
			if (!Number.isFinite(new Date(metadata.createdAt).getTime())) {
				throw new Error('Invalid backup archive: metadata.createdAt is not a valid ISO date');
			}

			// Security: validate that metadata.id is a valid UUIDv4 to prevent path traversal.
			// Must be v4 specifically — every other controller endpoint (download, restore,
			// delete) uses ParseUUIDPipe({ version: '4' }), so accepting v1/v3/v5 here would
			// leave uploaded backups visible but unmanageable through the API.
			const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

			if (!uuidV4Regex.test(metadata.id)) {
				throw new Error('Invalid backup archive: metadata.id is not a valid UUIDv4');
			}

			// Move to final location using the ID from metadata. Refuse to overwrite an
			// existing backup — the uploaded metadata.id is attacker-controlled and a forged
			// collision would otherwise silently replace a real local backup (and its sidecar)
			// with archive contents chosen by the uploader.
			finalPath = this.getBackupPath(metadata.id);

			if (existsSync(finalPath)) {
				throw new Error(`Backup with id=${metadata.id} already exists — refusing to overwrite`);
			}

			copyFileSync(tempTarPath, finalPath);
			rmSync(tempTarPath, { force: true });
			rmSync(tempDir, { recursive: true, force: true });

			const stats = statSync(finalPath);

			this.logger.log(`Uploaded backup saved: id=${metadata.id}, size=${stats.size} bytes`);

			// Persist a sidecar so list() can skip tar extraction
			this.writeMetadataSidecar(metadata.id, metadata);

			// Preserve the just-uploaded backup from cleanup — its `createdAt` may be older
			// than existing backups (e.g. imported from another machine), which would otherwise
			// make it the immediate deletion target and silently discard the user's upload
			await this.cleanupOldBackups(metadata.id);

			return {
				...metadata,
				sizeBytes: stats.size,
			};
		} catch (error) {
			// Cleanup on failure — also unwind finalPath if we copied it before a later
			// step (sidecar write, retention sweep) failed, otherwise the archive orphans
			if (existsSync(tempTarPath)) {
				rmSync(tempTarPath, { force: true });
			}

			rmSync(tempDir, { recursive: true, force: true });

			if (finalPath && existsSync(finalPath)) {
				rmSync(finalPath, { force: true });
			}

			throw error;
		}
	}

	private async cleanupOldBackups(preserveId?: string): Promise<void> {
		const backups = await this.list();

		if (backups.length <= MAX_BACKUPS) {
			return;
		}

		// Pick deletion candidates from oldest-first, excluding the protected backup so a
		// freshly created/uploaded archive is never deleted by its own retention sweep
		const candidates = backups
			.filter((backup) => backup.id !== preserveId)
			.sort((a, b) => this.getCreatedAtMs(a.createdAt) - this.getCreatedAtMs(b.createdAt));

		const excessCount = backups.length - MAX_BACKUPS;
		const toRemove = candidates.slice(0, excessCount);

		for (const backup of toRemove) {
			try {
				this.delete(backup.id);

				this.logger.debug(`Cleaned up old backup: id=${backup.id}`);
			} catch (error) {
				this.logger.warn(`Failed to cleanup old backup: id=${backup.id}`, { error });
			}
		}
	}
}
