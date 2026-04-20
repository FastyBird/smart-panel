import { FastifyReply as Reply, FastifyRequest as Request } from 'fastify';
import { createReadStream, existsSync, statSync } from 'fs';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	Res,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { MULTIPART_MAX_FILE_SIZE_BYTES } from '../../../app.constants';
import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiBinarySuccessResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqCreateBackupDto } from '../dto/create-backup.dto';
import { BackupResponseModel, BackupsResponseModel } from '../models/backup-response.model';
import { BackupDataModel } from '../models/backup.model';
import { BackupArchiveError, BackupMetadata, BackupService } from '../services/backup.service';
import { SYSTEM_MODULE_API_TAG_NAME, SYSTEM_MODULE_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('backups')
export class BackupController {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'BackupController');

	constructor(private readonly backupService: BackupService) {}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'List backups',
		description: 'Retrieve a list of all available system backups',
		operationId: 'get-system-module-backups',
	})
	@ApiSuccessResponse(BackupsResponseModel, 'Backups retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get()
	async list(): Promise<BackupsResponseModel> {
		this.logger.debug('Listing backups');

		try {
			const backups = await this.backupService.list();

			const response = new BackupsResponseModel();
			response.data = backups.map((b) => this.mapMetadata(b));

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to list backups: ${err.message}`);

			throw new InternalServerErrorException('Failed to list backups');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Create backup',
		description: 'Create a new system backup including database and registered contributions',
		operationId: 'create-system-module-backup',
	})
	@ApiBody({ type: ReqCreateBackupDto, required: false })
	@ApiCreatedSuccessResponse(BackupResponseModel, 'Backup created successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post()
	async create(@Body() body?: ReqCreateBackupDto): Promise<BackupResponseModel> {
		this.logger.debug('Creating backup');

		try {
			const metadata = await this.backupService.create(body?.data?.name);

			const response = new BackupResponseModel();
			response.data = this.mapMetadata(metadata);

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to create backup: ${err.message}`);

			throw new InternalServerErrorException('Failed to create backup');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Download backup',
		description: 'Download a backup archive as a tar.gz file',
		operationId: 'get-system-module-backup-download',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Backup ID' })
	@ApiBinarySuccessResponse({ 'application/gzip': { type: 'string', format: 'binary' } }, 'Backup archive file')
	@ApiNotFoundResponse('Backup not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get(':id/download')
	async download(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Res() reply: Reply): Promise<void> {
		this.logger.debug(`Downloading backup id=${id}`);

		const backupPath = this.backupService.getBackupPath(id);

		if (!existsSync(backupPath)) {
			throw new NotFoundException('Backup not found');
		}

		const stream = createReadStream(backupPath);

		void reply.header('Content-Type', 'application/gzip');
		void reply.header('Content-Disposition', `attachment; filename="smart-panel-backup-${id}.tar.gz"`);

		return reply.send(stream);
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Upload backup',
		description: 'Upload a backup archive to be stored for later restoration',
		operationId: 'upload-system-module-backup',
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		description: 'Backup archive file to upload',
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
					description: 'Backup archive file (.tar.gz)',
				},
			},
			required: ['file'],
		},
	})
	@ApiCreatedSuccessResponse(BackupResponseModel, 'Backup uploaded successfully')
	@ApiBadRequestResponse('No file uploaded or invalid backup archive')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post('upload')
	async upload(@Req() req: Request): Promise<BackupResponseModel> {
		this.logger.debug('Uploading backup');

		try {
			const file = await (
				req as Request & {
					file: () => Promise<
						| { mimetype: string; filename: string; file: { truncated: boolean }; toBuffer: () => Promise<Buffer> }
						| undefined
					>;
				}
			).file();

			if (!file) {
				throw new BadRequestException('No file uploaded');
			}

			// Must call toBuffer before checking truncated — fastify-multipart sets the
			// flag while streaming the upload. Without this check, an oversized upload
			// is silently truncated and the service fails later with a misleading error.
			const buffer = await file.toBuffer();

			if (file.file.truncated) {
				const limitMb = Math.round(MULTIPART_MAX_FILE_SIZE_BYTES / (1024 * 1024));

				throw new BadRequestException(`Backup archive exceeds the ${limitMb} MB upload size limit`);
			}

			const metadata = await this.backupService.saveUploadedBackup(buffer, file.filename);

			const response = new BackupResponseModel();
			response.data = this.mapMetadata(metadata);

			return response;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			// Archive-integrity/security failures (bad metadata, UUID, traversal, symlinks,
			// duplicate id) are client errors — return 400 with the original message so the
			// admin sees what's wrong with the archive instead of a generic 500.
			if (error instanceof BackupArchiveError) {
				this.logger.warn(`Rejected uploaded backup: ${error.message}`);

				throw new BadRequestException(error.message);
			}

			const err = error as Error;

			this.logger.error(`Failed to upload backup: ${err.message}`);

			throw new InternalServerErrorException('Failed to upload backup');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Restore backup',
		description: 'Restore the system from a backup. The system will restart after restoration.',
		operationId: 'post-system-module-backup-restore',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Backup ID' })
	@ApiSuccessResponse(BackupResponseModel, 'Backup restoration initiated')
	@ApiNotFoundResponse('Backup not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Post(':id/restore')
	async restore(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<BackupResponseModel> {
		this.logger.debug(`Restoring backup id=${id}`);

		// Preflight synchronously so archive/safety failures surface as HTTP errors
		// before we kick off the actual restore. Any throw here aborts without touching
		// live state.
		let metadata: BackupMetadata;

		try {
			metadata = await this.backupService.prepareRestore(id);
		} catch (error) {
			const err = error as Error;

			if (err.message.startsWith('Backup not found')) {
				throw new NotFoundException('Backup not found');
			}

			this.logger.error(`Backup restore preflight failed: ${err.message}`);

			throw new BadRequestException(`Backup cannot be restored: ${err.message}`);
		}

		// Run the restore inline so the caller gets a real answer. A pre-PNR failure
		// (disk full during extraction, archive deleted between preflight and restore,
		// permission error) propagates here as an HTTP error instead of silently
		// landing in a fire-and-forget .catch. A post-PNR failure inside restore()
		// calls process.exit(1) itself so the handler never returns in that case.
		try {
			await this.backupService.restore(id);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to restore backup: ${err.message}`, err.stack);

			throw new InternalServerErrorException(`Failed to restore backup: ${err.message}`);
		}

		const response = new BackupResponseModel();
		response.data = this.mapMetadata(metadata);

		// Schedule the clean exit after Fastify has flushed the success envelope.
		// The restore body has already mutated disk state — systemd/the supervisor
		// restarts the process and migrations run on boot.
		setTimeout(() => process.exit(0), 1000);

		return response;
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Delete backup',
		description: 'Delete a backup archive',
		operationId: 'delete-system-module-backup',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Backup ID' })
	@ApiSuccessResponse(BackupResponseModel, 'Backup deleted successfully')
	@ApiNotFoundResponse('Backup not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<BackupResponseModel> {
		this.logger.debug(`Deleting backup id=${id}`);

		const backupPath = this.backupService.getBackupPath(id);

		if (!existsSync(backupPath)) {
			throw new NotFoundException('Backup not found');
		}

		// Try to load metadata for the response envelope but do not fail the delete
		// if the archive is corrupt or tampered — the admin needs to be able to remove
		// broken backups through the API. list() handles the same error gracefully.
		let metadata: BackupMetadata | null = null;

		try {
			metadata = await this.backupService.getMetadata(id);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Deleting backup ${id} with unreadable metadata: ${err.message}`);
		}

		// Capture the stub before deletion — building it after delete() would statSync
		// a path that no longer exists and surface as a misleading 500
		const responseMetadata = metadata ?? this.stubMetadata(id, backupPath);

		try {
			this.backupService.delete(id);

			const response = new BackupResponseModel();
			response.data = this.mapMetadata(responseMetadata);

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete backup: ${err.message}`);

			throw new InternalServerErrorException('Failed to delete backup');
		}
	}

	// Minimal metadata for the response envelope when the archive is present but its
	// metadata is unreadable. mtime/size are pulled from the file so the admin still
	// sees meaningful information about the backup that was deleted.
	private stubMetadata(id: string, backupPath: string): BackupMetadata {
		const stats = statSync(backupPath);

		return {
			id,
			name: '',
			version: '',
			createdAt: stats.mtime.toISOString(),
			sizeBytes: stats.size,
			contributions: [],
		};
	}

	private mapMetadata(metadata: BackupMetadata): BackupDataModel {
		const mapped = toInstance(BackupDataModel, {
			id: metadata.id,
			name: metadata.name,
			version: metadata.version,
			createdAt: metadata.createdAt,
			sizeBytes: metadata.sizeBytes,
			contributions: metadata.contributions.map(({ source, label, type }) => ({ source, label, type })),
		});

		return mapped;
	}
}
