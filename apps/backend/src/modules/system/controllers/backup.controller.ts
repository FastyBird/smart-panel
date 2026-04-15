import { FastifyReply as Reply, FastifyRequest as Request } from 'fastify';
import { createReadStream, existsSync } from 'fs';

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

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
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
import { BackupMetadata, BackupService } from '../services/backup.service';
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
			response.data = backups.map((b) => this.toDataModel(b));

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
			response.data = this.toDataModel(metadata);

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

			const buffer = await file.toBuffer();
			const metadata = await this.backupService.saveUploadedBackup(buffer, file.filename);

			const response = new BackupResponseModel();
			response.data = this.toDataModel(metadata);

			return response;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
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

		const metadata = await this.backupService.getMetadata(id);

		if (!metadata) {
			throw new NotFoundException('Backup not found');
		}

		const response = new BackupResponseModel();
		response.data = this.toDataModel(metadata);

		// Start restore asynchronously — this will exit the process on success
		this.backupService.restore(id).catch((error: Error) => {
			this.logger.error(`Failed to restore backup: ${error.message}`, error.stack);
		});

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

		const metadata = await this.backupService.getMetadata(id);

		if (!metadata) {
			throw new NotFoundException('Backup not found');
		}

		try {
			this.backupService.delete(id);

			const response = new BackupResponseModel();
			response.data = this.toDataModel(metadata);

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete backup: ${err.message}`);

			throw new InternalServerErrorException('Failed to delete backup');
		}
	}

	private toDataModel(metadata: BackupMetadata): BackupDataModel {
		return toInstance(BackupDataModel, {
			id: metadata.id,
			name: metadata.name,
			version: metadata.version,
			createdAt: metadata.createdAt,
			sizeBytes: metadata.sizeBytes,
			contributions: metadata.contributions,
		});
	}
}
