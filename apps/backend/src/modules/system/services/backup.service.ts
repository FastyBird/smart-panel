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
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger';
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
	contributions: { source: string; label: string; type: string; path: string }[];
}

@Injectable()
export class BackupService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'BackupService');

	private readonly dbPath: string;
	private readonly backupsDir: string;

	constructor(
		private readonly configService: NestConfigService,
		private readonly contributionRegistry: BackupContributionRegistry,
	) {
		const dbDir = this.configService.get<string>('FB_DB_PATH', resolve(__dirname, '../../../../../../var/db'));

		this.dbPath = join(dbDir, 'database.sqlite');

		const dataDir = this.configService.get<string>('FB_DATA_DIR', '/var/lib/smart-panel');

		this.backupsDir = join(dataDir, 'backups');

		if (!existsSync(this.backupsDir)) {
			mkdirSync(this.backupsDir, { recursive: true });

			this.logger.debug(`Created backups directory: ${this.backupsDir}`);
		}
	}

	async create(name?: string): Promise<BackupMetadata> {
		const id = uuid();
		const backupName = name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
		const tempDir = join(this.backupsDir, `temp-${id}`);
		const tarPath = join(this.backupsDir, `${id}.tar.gz`);

		this.logger.debug(`Creating backup id=${id} name=${backupName}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Copy database
			if (existsSync(this.dbPath)) {
				copyFileSync(this.dbPath, join(tempDir, 'database.sqlite'));

				this.logger.debug('Database copied to backup');
			} else {
				this.logger.warn(`Database file not found at ${this.dbPath}, skipping`);
			}

			// Copy contributions
			const contributions = this.contributionRegistry.getContributions();
			const includedContributions: { source: string; label: string; type: string; path: string }[] = [];

			for (const contribution of contributions) {
				if (!existsSync(contribution.path)) {
					if (contribution.optional) {
						this.logger.debug(`Optional contribution not found, skipping: ${contribution.path}`);

						continue;
					}

					this.logger.warn(`Required contribution not found: ${contribution.path}`);

					continue;
				}

				const contributionDir = join(tempDir, 'contributions', contribution.source);

				mkdirSync(contributionDir, { recursive: true });

				if (contribution.type === 'file') {
					const fileName = contribution.path.split('/').pop() || 'file';

					copyFileSync(contribution.path, join(contributionDir, fileName));
				} else {
					cpSync(contribution.path, join(contributionDir, contribution.path.split('/').pop() || 'dir'), {
						recursive: true,
					});
				}

				includedContributions.push({
					source: contribution.source,
					label: contribution.label,
					type: contribution.type,
					path: contribution.path,
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

			// Cleanup old backups
			await this.cleanupOldBackups();

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

		this.logger.log(`Backup deleted: id=${id}`);
	}

	async restore(id: string): Promise<void> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			throw new Error(`Backup not found: ${id}`);
		}

		const tempDir = join(this.backupsDir, `restore-${id}`);

		this.logger.log(`Restoring backup id=${id}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Extract tar.gz
			await execFileAsync('tar', ['-xzf', tarPath, '-C', tempDir]);

			// Validate metadata
			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				throw new Error('Invalid backup: metadata.json not found');
			}

			const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as BackupMetadata;

			if (!metadata.id || !metadata.version) {
				throw new Error('Invalid backup: metadata is missing required fields');
			}

			// Restore database
			const backupDbPath = join(tempDir, 'database.sqlite');

			if (existsSync(backupDbPath)) {
				const dbDir = resolve(this.dbPath, '..');

				if (!existsSync(dbDir)) {
					mkdirSync(dbDir, { recursive: true });
				}

				copyFileSync(backupDbPath, this.dbPath);

				this.logger.log('Database restored from backup');
			}

			// Restore contributions — only to paths that are currently registered
			// to prevent path traversal from crafted backup archives
			if (metadata.contributions && metadata.contributions.length > 0) {
				const registeredContributions = this.contributionRegistry.getContributions();
				const registeredPaths = registeredContributions.map((c) => c.path);

				for (const contribution of metadata.contributions) {
					// Security: only restore to paths that match a registered contribution
					if (!registeredPaths.includes(contribution.path)) {
						this.logger.warn(
							`Skipping unregistered contribution path: ${contribution.path} (source: ${contribution.source})`,
						);

						continue;
					}

					const contributionDir = join(tempDir, 'contributions', contribution.source.replace(/[^a-zA-Z0-9_-]/g, '_'));
					const itemName = (contribution.path.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
					const sourcePath = join(contributionDir, itemName);

					if (!existsSync(sourcePath)) {
						this.logger.warn(`Contribution source not found in backup: ${contribution.label}`);

						continue;
					}

					// Ensure target directory exists
					const targetDir = resolve(contribution.path, '..');

					if (!existsSync(targetDir)) {
						mkdirSync(targetDir, { recursive: true });
					}

					if (contribution.type === 'directory') {
						cpSync(sourcePath, contribution.path, { recursive: true });
					} else {
						copyFileSync(sourcePath, contribution.path);
					}

					this.logger.debug(`Restored contribution: ${contribution.label} to ${contribution.path}`);
				}
			}

			// Cleanup temp dir
			rmSync(tempDir, { recursive: true, force: true });

			this.logger.log(`Backup restored successfully: id=${id}. Exiting process for restart.`);

			// Exit process - systemd will restart, migrations run on boot
			process.exit(0);
		} catch (error) {
			// Cleanup on failure
			rmSync(tempDir, { recursive: true, force: true });

			throw error;
		}
	}

	async getMetadata(id: string): Promise<BackupMetadata | null> {
		const tarPath = this.getBackupPath(id);

		if (!existsSync(tarPath)) {
			return null;
		}

		const tempDir = join(this.backupsDir, `meta-${id}`);

		try {
			mkdirSync(tempDir, { recursive: true });

			// Extract only metadata.json
			await execFileAsync('tar', ['-xzf', tarPath, '-C', tempDir, './metadata.json']);

			const metadataPath = join(tempDir, 'metadata.json');

			if (!existsSync(metadataPath)) {
				rmSync(tempDir, { recursive: true, force: true });

				return null;
			}

			const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Omit<BackupMetadata, 'sizeBytes'>;

			// Get file size from the archive
			const stats = statSync(tarPath);

			rmSync(tempDir, { recursive: true, force: true });

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

	async saveUploadedBackup(buffer: Buffer, _originalFilename?: string): Promise<BackupMetadata> {
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

	private async cleanupOldBackups(): Promise<void> {
		const backups = await this.list();

		if (backups.length <= MAX_BACKUPS) {
			return;
		}

		// Remove oldest backups beyond the limit
		const toRemove = backups.slice(MAX_BACKUPS);

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
