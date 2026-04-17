import { execFile } from 'child_process';
import {
	copyFileSync,
	cpSync,
	existsSync,
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

			// Create a consistent database snapshot using SQLite VACUUM INTO
			// (safe even during concurrent writes, unlike copyFileSync)
			if (existsSync(this.dbPath)) {
				const backupDbPath = join(tempDir, 'database.sqlite');

				try {
					await execFileAsync('sqlite3', [this.dbPath, `.backup '${backupDbPath}'`]);
				} catch {
					// Fallback to file copy if sqlite3 CLI is not available
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

		// Sort by creation date, newest first
		backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		return backups;
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

		// Set once we start tearing down the live DataSource — past this point the app
		// can no longer serve requests, so any failure must exit the process instead of
		// propagating back to the caller (which would leave a broken app running)
		let pointOfNoReturn = false;

		try {
			mkdirSync(tempDir, { recursive: true });

			// Extract tar.gz with path traversal protection
			// List archive contents first and verify no path traversal
			const { stdout: tarContents } = await execFileAsync('tar', ['-tzf', tarPath]);

			if (tarContents.split('\n').some((entry) => entry.includes('..'))) {
				throw new Error('Invalid backup: archive contains path traversal entries');
			}

			await execFileAsync('tar', ['--no-same-owner', '--no-same-permissions', '-xzf', tarPath, '-C', tempDir]);

			// Validate metadata
			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new Error('Invalid backup: metadata.json not found');
			}

			const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as BackupMetadata;

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

					if (!existsSync(contributionDir)) {
						this.logger.warn(`Contribution source not found in backup: ${contribution.label}`);

						continue;
					}

					// Each contribution dir holds exactly one entry (file or directory) — discover it
					// rather than relying on a stored path, which would leak the source machine's layout
					const entries = readdirSync(contributionDir);

					if (entries.length !== 1) {
						this.logger.warn(
							`Unexpected contribution archive layout for ${contribution.label}: ${entries.length} entries`,
						);

						continue;
					}

					const sourcePath = join(contributionDir, entries[0]);

					// Restore to the currently registered path, not the path from the backup
					const targetPath = registered.path;
					const targetDir = resolve(targetPath, '..');

					if (!existsSync(targetDir)) {
						mkdirSync(targetDir, { recursive: true });
					}

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

					try {
						await this.dataSource.destroy();
					} catch (error) {
						this.logger.warn('Failed to cleanly close DataSource before DB restore', { error });
					}
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
				// DataSource is already destroyed — continuing would keep a broken app alive
				// with every DB call failing. Exit non-zero so systemd restarts the process
				// and the user can retry (the backup on disk may be partially swapped).
				this.logger.error(
					`Backup restore failed after DataSource teardown: ${(error as Error).message}. Exiting for restart.`,
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

			await execFileAsync('tar', ['-xzf', tarPath, '-C', tempDir, './metadata.json']);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				rmSync(tempDir, { recursive: true, force: true });

				return null;
			}

			const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Omit<BackupMetadata, 'sizeBytes'>;

			rmSync(tempDir, { recursive: true, force: true });

			this.writeMetadataSidecar(id, metadata);

			return {
				...metadata,
				sizeBytes: stats.size,
			};
		} catch (error) {
			rmSync(tempDir, { recursive: true, force: true });

			this.logger.warn(`Failed to extract metadata from backup ${id}`, { error });

			return null;
		}
	}

	private getMetadataSidecarPath(id: string): string {
		return join(this.backupsDir, `${id}.json`);
	}

	private writeMetadataSidecar(id: string, metadata: Omit<BackupMetadata, 'sizeBytes'>): void {
		try {
			writeFileSync(this.getMetadataSidecarPath(id), JSON.stringify(metadata, null, 2));
		} catch (error) {
			this.logger.warn(`Failed to write metadata sidecar for backup ${id}`, { error });
		}
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

		try {
			// Save uploaded file
			writeFileSync(tempTarPath, buffer);

			// Extract metadata to validate
			mkdirSync(tempDir, { recursive: true });

			await execFileAsync('tar', ['-xzf', tempTarPath, '-C', tempDir, './metadata.json']);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new Error('Invalid backup archive: metadata.json not found');
			}

			const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Omit<BackupMetadata, 'sizeBytes'>;

			if (!metadata.id || !metadata.version) {
				throw new Error('Invalid backup archive: metadata is missing required fields');
			}

			// Security: validate that metadata.id is a valid UUID to prevent path traversal
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

			if (!uuidRegex.test(metadata.id)) {
				throw new Error('Invalid backup archive: metadata.id is not a valid UUID');
			}

			// Move to final location using the ID from metadata
			const finalPath = this.getBackupPath(metadata.id);

			if (existsSync(finalPath)) {
				rmSync(finalPath, { force: true });
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
			// Cleanup on failure
			if (existsSync(tempTarPath)) {
				rmSync(tempTarPath, { force: true });
			}

			rmSync(tempDir, { recursive: true, force: true });

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
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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
