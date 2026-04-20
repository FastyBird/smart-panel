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
import { join, relative, resolve, sep } from 'path';
import { DataSource } from 'typeorm';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { BackupContributionRegistry, BackupContributionType } from './backup-contribution-registry.service';

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

export interface BackupMetadataContribution {
	source: string;
	label: string;
	type: BackupContributionType;
}

export interface BackupMetadata {
	id: string;
	name: string;
	version: string;
	createdAt: string;
	sizeBytes: number;
	contributions: BackupMetadataContribution[];
}

type StoredBackupMetadata = Omit<BackupMetadata, 'sizeBytes'>;

const ALLOWED_CONTRIBUTION_TYPES: readonly BackupContributionType[] = ['file', 'directory'];

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a freshly-parsed metadata JSON object. Narrows its `contributions[].type`
 * from string to the literal union and throws BackupArchiveError on any shape
 * violation — callers can then rely on a fully-typed result without casts.
 */
function parseStoredMetadata(raw: unknown): StoredBackupMetadata {
	if (typeof raw !== 'object' || raw === null) {
		throw new BackupArchiveError('Invalid backup archive: metadata is not an object');
	}

	const candidate = raw as Record<string, unknown>;

	const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

	if (
		!isNonEmptyString(candidate.id) ||
		!isNonEmptyString(candidate.name) ||
		!isNonEmptyString(candidate.version) ||
		!isNonEmptyString(candidate.createdAt)
	) {
		throw new BackupArchiveError('Invalid backup archive: metadata is missing required fields');
	}

	// Enforce UUIDv4 on the id to prevent path-traversal: the id flows through
	// getBackupPath(id) -> join(backupsDir, `${id}.tar.gz`) and into delete()/rmSync.
	// A tampered sidecar with `../../etc/passwd` would otherwise traverse outside
	// the backups dir. UUIDv4 leaves no room for separators or `..`.
	if (!UUID_V4_REGEX.test(candidate.id)) {
		throw new BackupArchiveError('Invalid backup archive: metadata.id is not a valid UUIDv4');
	}

	if (!Array.isArray(candidate.contributions)) {
		throw new BackupArchiveError('Invalid backup archive: metadata.contributions is not an array');
	}

	const contributions: BackupMetadataContribution[] = candidate.contributions.map((entry, index) => {
		if (typeof entry !== 'object' || entry === null) {
			throw new BackupArchiveError(`Invalid backup archive: metadata.contributions[${index}] is not an object`);
		}

		const contribution = entry as Record<string, unknown>;

		if (
			typeof contribution.source !== 'string' ||
			typeof contribution.label !== 'string' ||
			typeof contribution.type !== 'string'
		) {
			throw new BackupArchiveError(
				`Invalid backup archive: metadata.contributions[${index}] is missing required fields`,
			);
		}

		if (!ALLOWED_CONTRIBUTION_TYPES.includes(contribution.type as BackupContributionType)) {
			throw new BackupArchiveError(
				`Invalid backup archive: metadata.contributions[${index}].type must be "file" or "directory"`,
			);
		}

		return {
			source: contribution.source,
			label: contribution.label,
			type: contribution.type as BackupContributionType,
		};
	});

	return {
		id: candidate.id,
		name: candidate.name,
		version: candidate.version,
		createdAt: candidate.createdAt,
		contributions,
	};
}

@Injectable()
export class BackupService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'BackupService');

	private readonly dbPath: string;
	private readonly backupsDir: string;

	constructor(
		private readonly configService: NestConfigService,
		private readonly contributionRegistry: BackupContributionRegistry,
		private readonly eventEmitter: EventEmitter2,
		@InjectDataSource() private readonly dataSource: DataSource,
	) {
		const dbDir = getEnvValue<string>(this.configService, 'FB_DB_PATH', resolve(__dirname, '../../../../../../var/db'));

		this.dbPath = join(dbDir, 'database.sqlite');

		const dataDir = getEnvValue<string>(this.configService, 'FB_DATA_DIR', resolve(__dirname, '../../../../../../var'));

		this.backupsDir = join(dataDir, 'backups');
	}

	// Lazy so construction doesn't require write access to backupsDir
	private ensureBackupsDir(): void {
		if (!existsSync(this.backupsDir)) {
			mkdirSync(this.backupsDir, { recursive: true });

			this.logger.debug(`Created backups directory: ${this.backupsDir}`);
		}
	}

	async create(name?: string): Promise<BackupMetadata> {
		this.ensureBackupsDir();

		const id = uuid();
		// Trim and fall back to a timestamped default so whitespace-only names don't
		// produce blank-looking entries in the UI and download filenames
		const trimmedName = name?.trim() ?? '';
		const backupName =
			trimmedName.length > 0 ? trimmedName : `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
		const tempDir = join(this.backupsDir, `temp-${id}`);
		const tarPath = join(this.backupsDir, `${id}.tar.gz`);
		let sidecarPath: string | null = null;
		let fullMetadata: BackupMetadata;

		this.logger.debug(`Creating backup id=${id} name=${backupName}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Snapshot the live SQLite file via the `sqlite3` CLI's .backup command so
			// concurrent writes don't corrupt the copy. copyFileSync races the WAL and is
			// only safe as a fallback when the CLI isn't installed.
			if (existsSync(this.dbPath)) {
				const backupDbPath = join(tempDir, 'database.sqlite');

				try {
					// Escape embedded single quotes using SQLite's shell convention (two
					// consecutive quotes represent a literal quote inside a quoted string),
					// so a FB_DATA_DIR containing `'` doesn't produce a .backup parse error
					// that would then propagate past the CLI-missing fallback as a hard failure.
					const escapedBackupPath = backupDbPath.replace(/'/g, "''");

					await execFileAsync('sqlite3', [this.dbPath, `.backup '${escapedBackupPath}'`]);
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
			const includedContributions: BackupMetadataContribution[] = [];

			for (const contribution of contributions) {
				if (!existsSync(contribution.path)) {
					if (contribution.optional) {
						this.logger.debug(`Optional contribution not found, skipping: ${contribution.path}`);

						continue;
					}

					throw new Error(
						`Required backup contribution is missing: ${contribution.label} (${contribution.source}) at ${contribution.path}`,
					);
				}

				// source + label disambiguates multiple contributions from the same module
				const safeSource = contribution.source.replace(/[^a-zA-Z0-9_-]/g, '_');
				const safeLabel = (contribution.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
				const contributionDir = join(tempDir, 'contributions', safeSource, safeLabel);

				mkdirSync(contributionDir, { recursive: true });

				if (contribution.type === 'file') {
					const fileName = (contribution.path.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

					copyFileSync(contribution.path, join(contributionDir, fileName));
				} else {
					const dirName = (contribution.path.split('/').pop() || 'dir').replace(/[^a-zA-Z0-9._-]/g, '_');
					const sourceRoot = contribution.path;
					const excludeSet = new Set(contribution.exclude ?? []);

					cpSync(contribution.path, join(contributionDir, dirName), {
						recursive: true,
						// Skip top-level entries named in the exclude list (e.g. shipped
						// seed data that belongs to the app, not the user's backup)
						filter: (src) => {
							if (excludeSet.size === 0 || src === sourceRoot) {
								return true;
							}

							const rel = relative(sourceRoot, src);
							const firstSegment = rel.split(sep)[0];

							return !excludeSet.has(firstSegment);
						},
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
			const metadata: StoredBackupMetadata = {
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
			sidecarPath = this.getMetadataSidecarPath(id);

			fullMetadata = {
				...metadata,
				sizeBytes: stats.size,
			};

			this.logger.log(`Backup created successfully: id=${id}, size=${stats.size} bytes`);
		} catch (error) {
			// Cleanup on failure — also unwind the sidecar if we got that far, otherwise
			// a later cleanupOldBackups throw would orphan the {id}.json on disk
			rmSync(tempDir, { recursive: true, force: true });

			if (existsSync(tarPath)) {
				rmSync(tarPath, { force: true });
			}

			if (sidecarPath && existsSync(sidecarPath)) {
				rmSync(sidecarPath, { force: true });
			}

			throw error;
		}

		// Retention sweep runs AFTER the backup is fully committed. Any failure here
		// (e.g. list() hitting a permission error on a sibling archive) would have
		// previously landed in the catch above and deleted the backup we just made.
		try {
			await this.cleanupOldBackups(id);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Retention sweep failed after creating backup ${id}: ${err.message}`);
		}

		return fullMetadata;
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

	/**
	 * Validate that an archive is restorable without mutating any live state.
	 * Hardlinks the archive into a private dir, runs the full safety check, extracts
	 * metadata.json, and validates its shape — all the failure modes that previously
	 * hit the controller's fire-and-forget `.catch` after a 200 had already returned.
	 * The caller should await this before kicking off the asynchronous restore so the
	 * user sees a real HTTP error on bad/missing archives.
	 */
	async prepareRestore(id: string): Promise<BackupMetadata> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			throw new Error(`Backup not found: ${id}`);
		}

		const tempDir = join(this.backupsDir, `preflight-${id}-${uuid()}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			const workingArchive = join(tempDir, 'archive.tar.gz');

			this.pinArchive(tarPath, workingArchive);

			await this.validateArchiveSafety(workingArchive);

			await execFileAsync('tar', [
				'--no-same-owner',
				'--no-same-permissions',
				'-xzf',
				workingArchive,
				'-C',
				tempDir,
				'./metadata.json',
			]);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new BackupArchiveError('Invalid backup: metadata.json not found');
			}

			const metadata = parseStoredMetadata(JSON.parse(this.readExtractedFileSafely(metadataPath)));

			return {
				...metadata,
				sizeBytes: statSync(tarPath).size,
			};
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	}

	async restore(id: string): Promise<void> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			throw new Error(`Backup not found: ${id}`);
		}

		const tempDir = join(this.backupsDir, `restore-${id}`);

		this.logger.log(`Restoring backup id=${id}`);

		// Once true, any failure must process.exit — live host state is partially
		// replaced and restart is the only safe recovery
		let pointOfNoReturn = false;

		try {
			mkdirSync(tempDir, { recursive: true });

			const workingArchive = join(tempDir, 'archive.tar.gz');

			this.pinArchive(tarPath, workingArchive);

			await this.validateArchiveSafety(workingArchive);

			await execFileAsync('tar', ['--no-same-owner', '--no-same-permissions', '-xzf', workingArchive, '-C', tempDir]);

			// Validate metadata
			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new BackupArchiveError('Invalid backup: metadata.json not found');
			}

			const metadata = parseStoredMetadata(JSON.parse(this.readExtractedFileSafely(metadataPath)));

			// Contributions first — overwriting the DB while the app is still running with
			// open connections lets SQLite rewrite WAL from its cached view of the OLD DB,
			// which would replay onto the restored file on next boot and corrupt it
			if (metadata.contributions && metadata.contributions.length > 0) {
				const registrations = this.contributionRegistry.getRegistrations();
				const contributionKey = (source: string, label: string): string => `${source}\u0000${label}`;
				const registrationByKey = new Map(registrations.map((r) => [contributionKey(r.source, r.label), r] as const));

				// Two-pass ordering: contributions registered with a literal path first
				// (e.g. config dir), then lazy-callback paths (e.g. buddy personality).
				// A lazy callback reads live state — if a config-dir contribution swaps
				// that state, running the callback in pass 2 resolves against the
				// post-restore filesystem instead of the pre-restore one.
				const staticPass: BackupMetadataContribution[] = [];
				const lazyPass: BackupMetadataContribution[] = [];

				for (const contribution of metadata.contributions) {
					const registration = registrationByKey.get(contributionKey(contribution.source, contribution.label));

					if (registration && typeof registration.path === 'function') {
						lazyPass.push(contribution);
					} else {
						staticPass.push(contribution);
					}
				}

				const restoreContribution = (contribution: BackupMetadataContribution): void => {
					// Match by (source, label), not absolute path — paths differ between machines
					const registration = registrationByKey.get(contributionKey(contribution.source, contribution.label));

					if (!registration) {
						this.logger.warn(`Skipping unregistered contribution: ${contribution.source} (${contribution.label})`);

						return;
					}

					const safeSource = contribution.source.replace(/[^a-zA-Z0-9_-]/g, '_');
					const safeLabel = (contribution.label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
					const contributionDir = join(tempDir, 'contributions', safeSource, safeLabel);

					// Metadata claimed a contribution the archive doesn't actually hold — the
					// archive is corrupt. Throwing is safer than continuing: if the DB swap is
					// still ahead, PNR isn't set yet and the restore aborts cleanly; if a prior
					// iteration already flipped PNR, the catch handler exits for restart.
					if (!existsSync(contributionDir)) {
						throw new BackupArchiveError(`Invalid backup: contribution ${contribution.label} not present in archive`);
					}

					const entries = readdirSync(contributionDir);

					// Each contribution dir must hold exactly one entry (file or directory) — a
					// different count means the archive layout is corrupt or tampered with
					if (entries.length !== 1) {
						throw new BackupArchiveError(
							`Invalid backup: contribution ${contribution.label} has unexpected archive layout (${entries.length} entries)`,
						);
					}

					const sourcePath = join(contributionDir, entries[0]);

					// Resolve the target path right now — for lazy callbacks this runs
					// after pass-1 restored the config, so they see the post-restore layout
					const targetPath = typeof registration.path === 'function' ? registration.path() : registration.path;
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
					if (registration.type === 'directory') {
						const excludeSet = new Set(registration.exclude ?? []);

						if (excludeSet.size === 0) {
							// Remove the existing target before copying so files created after the
							// backup are cleared — cpSync merges rather than replacing, which would
							// otherwise leave stale state that can conflict with the restored DB
							if (existsSync(targetPath)) {
								rmSync(targetPath, { recursive: true, force: true });
							}

							cpSync(sourcePath, targetPath, { recursive: true });
						} else {
							// Preserve excluded top-level entries on the target: create() skipped
							// them so the archive doesn't contain them, and wiping the target would
							// also remove the live copy (e.g. shipped seeds the app still needs).
							// Also refuse to overwrite excluded targets with entries that happen to
							// match the excluded names in the archive — uploaded archives from
							// another system or version can't bypass the exclude guard.
							mkdirSync(targetPath, { recursive: true });

							for (const entry of readdirSync(targetPath)) {
								if (excludeSet.has(entry)) {
									continue;
								}

								rmSync(join(targetPath, entry), { recursive: true, force: true });
							}

							for (const entry of readdirSync(sourcePath)) {
								if (excludeSet.has(entry)) {
									this.logger.warn(
										`Skipping excluded entry "${entry}" found in archive for contribution ${contribution.label}`,
									);

									continue;
								}

								cpSync(join(sourcePath, entry), join(targetPath, entry), { recursive: true });
							}
						}
					} else {
						copyFileSync(sourcePath, targetPath);
					}

					this.logger.debug(`Restored contribution: ${contribution.label} to ${targetPath}`);
				};

				for (const contribution of staticPass) {
					restoreContribution(contribution);
				}

				if (lazyPass.length > 0) {
					// Invalidate in-memory caches that lazy callbacks will read from — pass 1
					// rewrote files on disk, but services like ConfigService hold their parsed
					// state in memory and would otherwise return pre-restore values.
					this.eventEmitter.emit(ConfigEventType.CONFIG_RELOAD);

					for (const contribution of lazyPass) {
						restoreContribution(contribution);
					}
				}
			}

			// Restore database LAST, after contributions are in place. Close the DataSource
			// first so SQLite flushes its WAL and releases file handles — otherwise the
			// running engine could rewrite WAL/SHM between our file swap and process.exit,
			// and those stale entries would replay onto the restored DB at next boot.
			const backupDbPath = join(tempDir, 'database.sqlite');

			if (existsSync(backupDbPath)) {
				// Flip PNR before ANY DB mutation — including the case where the
				// DataSource wasn't initialized (so destroy() is skipped). A later
				// copyFileSync failure (disk full, EACCES) otherwise propagates as a
				// regular error and leaves the live DB file in an undefined state.
				pointOfNoReturn = true;

				if (this.dataSource.isInitialized) {
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

			this.logger.log(`Backup restored successfully: id=${id}. Ready for process restart.`);

			// The controller schedules the clean process.exit(0) after flushing the HTTP
			// response so the caller actually sees the success envelope before we die
		} catch (error) {
			// Cleanup on failure
			rmSync(tempDir, { recursive: true, force: true });

			if (pointOfNoReturn) {
				// Live state already mutated — exit non-zero so systemd restarts clean
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
			// Defense in depth against a tampered sidecar: the parsed id must match
			// the filename-derived id. Even with UUIDv4 enforced by parseStoredMetadata,
			// a sidecar claiming a different backup's id would still let list() hand
			// that id to downstream callers (delete/restore) against the wrong target.
			if (sidecar.id !== id) {
				throw new BackupArchiveError(
					`Invalid backup sidecar for ${id}: metadata.id "${sidecar.id}" does not match filename`,
				);
			}

			return { ...sidecar, sizeBytes: stats.size };
		}

		// Fallback: extract metadata.json from the tar (e.g. legacy archives without a sidecar).
		// Cache the result as a sidecar so subsequent reads skip the tar subprocess.
		const tempDir = join(this.backupsDir, `meta-${id}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Pin the archive before validation + extraction to match restore/prepareRestore
			// and close the TOCTOU window on the public tarPath
			const workingArchive = join(tempDir, 'archive.tar.gz');

			this.pinArchive(tarPath, workingArchive);

			await this.validateArchiveSafety(workingArchive);

			await execFileAsync('tar', [
				'--no-same-owner',
				'--no-same-permissions',
				'-xzf',
				workingArchive,
				'-C',
				tempDir,
				'./metadata.json',
			]);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				rmSync(tempDir, { recursive: true, force: true });

				return null;
			}

			const metadata = parseStoredMetadata(JSON.parse(this.readExtractedFileSafely(metadataPath)));

			rmSync(tempDir, { recursive: true, force: true });

			// Same defense as the sidecar path — a tampered archive whose metadata.id
			// differs from the filename could otherwise have delete() aimed elsewhere
			if (metadata.id !== id) {
				throw new BackupArchiveError(
					`Invalid backup archive ${id}: metadata.id "${metadata.id}" does not match filename`,
				);
			}

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

	// Pin an archive into our private working dir so a concurrent rewrite of the
	// public path between our safety checks and extraction can't swap in a different
	// file. A hardlink keeps the original inode alive even if the public name is
	// replaced; cross-filesystem hosts fall back to a full copy.
	private pinArchive(sourcePath: string, destPath: string): void {
		try {
			linkSync(sourcePath, destPath);
		} catch (error) {
			const err = error as NodeJS.ErrnoException;

			if (err.code !== 'EXDEV') {
				throw error;
			}

			copyFileSync(sourcePath, destPath);
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

	private writeMetadataSidecar(id: string, metadata: StoredBackupMetadata): void {
		// Throws to the caller — without the sidecar, list() falls back to tar extraction
		// which also catches-and-returns-null, so a silent failure here would make the
		// just-saved backup invisible in the UI and unmanageable through the API.
		writeFileSync(this.getMetadataSidecarPath(id), JSON.stringify(metadata, null, 2));
	}

	private readMetadataSidecar(id: string): StoredBackupMetadata | null {
		const sidecarPath = this.getMetadataSidecarPath(id);

		if (!existsSync(sidecarPath)) {
			return null;
		}

		try {
			return parseStoredMetadata(JSON.parse(readFileSync(sidecarPath, 'utf-8')));
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
		let sidecarPath: string | null = null;
		let savedMetadata: BackupMetadata;
		let savedId: string;

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
				throw new BackupArchiveError('Invalid backup archive: metadata.json not found');
			}

			const metadata = parseStoredMetadata(JSON.parse(this.readExtractedFileSafely(metadataPath)));

			// createdAt must parse to a finite timestamp — list() and cleanupOldBackups
			// sort by Date.getTime() and NaN comparisons corrupt the ordering
			if (!Number.isFinite(new Date(metadata.createdAt).getTime())) {
				throw new BackupArchiveError('Invalid backup archive: metadata.createdAt is not a valid ISO date');
			}

			// Move to final location using the ID from metadata. Refuse to overwrite an
			// existing backup — the uploaded metadata.id is attacker-controlled and a forged
			// collision would otherwise silently replace a real local backup (and its sidecar)
			// with archive contents chosen by the uploader.
			finalPath = this.getBackupPath(metadata.id);

			if (existsSync(finalPath)) {
				throw new BackupArchiveError(`Backup with id=${metadata.id} already exists — refusing to overwrite`);
			}

			copyFileSync(tempTarPath, finalPath);
			rmSync(tempTarPath, { force: true });
			rmSync(tempDir, { recursive: true, force: true });

			const stats = statSync(finalPath);

			this.logger.log(`Uploaded backup saved: id=${metadata.id}, size=${stats.size} bytes`);

			// Persist a sidecar so list() can skip tar extraction
			this.writeMetadataSidecar(metadata.id, metadata);
			sidecarPath = this.getMetadataSidecarPath(metadata.id);

			savedId = metadata.id;
			savedMetadata = {
				...metadata,
				sizeBytes: stats.size,
			};
		} catch (error) {
			// Cleanup on failure — unwind both finalPath and the sidecar if we got that
			// far, otherwise a later step (cleanupOldBackups) throwing would orphan them
			if (existsSync(tempTarPath)) {
				rmSync(tempTarPath, { force: true });
			}

			rmSync(tempDir, { recursive: true, force: true });

			if (finalPath && existsSync(finalPath)) {
				rmSync(finalPath, { force: true });
			}

			if (sidecarPath && existsSync(sidecarPath)) {
				rmSync(sidecarPath, { force: true });
			}

			throw error;
		}

		// Retention sweep runs AFTER the upload is fully committed. A failure here
		// (list() permission error, etc.) would have previously landed in the catch
		// above and deleted the freshly uploaded archive.
		try {
			// Preserve the just-uploaded backup from cleanup — its `createdAt` may be older
			// than existing backups (e.g. imported from another machine), which would otherwise
			// make it the immediate deletion target and silently discard the user's upload
			await this.cleanupOldBackups(savedId);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Retention sweep failed after uploading backup ${savedId}: ${err.message}`);
		}

		return savedMetadata;
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
