import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	Body,
	Controller,
	Delete,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { setLocationHeader } from '../../../modules/api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { ReqCreateAnnouncementDto } from '../dto/create-announcement.dto';
import { ReqReorderAnnouncementsDto } from '../dto/reorder-announcements.dto';
import { ReqUpdateAnnouncementDto } from '../dto/update-announcement.dto';
import {
	SignageAnnouncementResponseModel,
	SignageAnnouncementsResponseModel,
} from '../models/signage-announcement-response.model';
import { SignageAnnouncementsService } from '../services/signage-announcements.service';
import {
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX,
} from '../spaces-signage-info-panel.constants';
import {
	SpacesSignageInfoPanelNotFoundException,
	SpacesSignageInfoPanelValidationException,
} from '../spaces-signage-info-panel.exceptions';

@ApiTags(SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME)
@Controller('spaces/:spaceId/announcements')
export class SignageAnnouncementsController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
		'SignageAnnouncementsController',
	);

	constructor(private readonly announcementsService: SignageAnnouncementsService) {}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'List announcements',
		description: 'List all announcements configured on a signage info-panel space.',
		operationId: 'get-spaces-signage-info-panel-plugin-announcements',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiSuccessResponse(SignageAnnouncementsResponseModel, 'Announcements retrieved successfully.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Signage space not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
	): Promise<SignageAnnouncementsResponseModel> {
		this.logger.debug(`[ANNOUNCEMENTS CONTROLLER] List announcements for spaceId=${spaceId}`);

		const announcements = await this.runOrRethrow(async () => this.announcementsService.findAll(spaceId));

		const response = new SignageAnnouncementsResponseModel();
		response.data = announcements;

		return response;
	}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'Get announcement',
		description: 'Retrieve a single announcement by ID.',
		operationId: 'get-spaces-signage-info-panel-plugin-announcement',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Announcement unique identifier' })
	@ApiSuccessResponse(SignageAnnouncementResponseModel, 'Announcement retrieved successfully.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Announcement or signage space not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<SignageAnnouncementResponseModel> {
		this.logger.debug(`[ANNOUNCEMENTS CONTROLLER] Get announcement id=${id} for spaceId=${spaceId}`);

		const announcement = await this.runOrRethrow(async () => this.announcementsService.getOneOrThrow(id, spaceId));

		const response = new SignageAnnouncementResponseModel();
		response.data = announcement;

		return response;
	}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'Create announcement',
		description: 'Create a new announcement on the signage info-panel space.',
		operationId: 'create-spaces-signage-info-panel-plugin-announcement',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiBody({ type: ReqCreateAnnouncementDto, description: 'Announcement creation payload' })
	@ApiCreatedSuccessResponse(
		SignageAnnouncementResponseModel,
		'Announcement created successfully.',
		'/api/v1/plugins/spaces-signage-info-panel/spaces/123e4567-e89b-12d3-a456-426614174000/announcements/123e4567-e89b-12d3-a456-426614174001',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Signage space not found')
	@ApiUnprocessableEntityResponse('Announcement could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
		@Body() createDto: ReqCreateAnnouncementDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<SignageAnnouncementResponseModel> {
		this.logger.debug(`[ANNOUNCEMENTS CONTROLLER] Create announcement for spaceId=${spaceId}`);

		const announcement = await this.runOrRethrow(async () => this.announcementsService.create(spaceId, createDto.data));

		setLocationHeader(
			req,
			res,
			SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX,
			`spaces/${spaceId}/announcements`,
			announcement.id,
			{ isPlugin: true },
		);

		const response = new SignageAnnouncementResponseModel();
		response.data = announcement;

		return response;
	}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'Update announcement',
		description: 'Update an existing announcement on the signage info-panel space.',
		operationId: 'update-spaces-signage-info-panel-plugin-announcement',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Announcement unique identifier' })
	@ApiBody({ type: ReqUpdateAnnouncementDto, description: 'Announcement update payload' })
	@ApiSuccessResponse(SignageAnnouncementResponseModel, 'Announcement updated successfully.')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Announcement or signage space not found')
	@ApiUnprocessableEntityResponse('Announcement could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateAnnouncementDto,
	): Promise<SignageAnnouncementResponseModel> {
		this.logger.debug(`[ANNOUNCEMENTS CONTROLLER] Update announcement id=${id} for spaceId=${spaceId}`);

		const announcement = await this.runOrRethrow(async () =>
			this.announcementsService.update(id, spaceId, updateDto.data),
		);

		const response = new SignageAnnouncementResponseModel();
		response.data = announcement;

		return response;
	}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'Delete announcement',
		description: 'Delete an announcement from the signage info-panel space.',
		operationId: 'delete-spaces-signage-info-panel-plugin-announcement',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Announcement unique identifier' })
	@ApiNoContentResponse({ description: 'Announcement deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Announcement or signage space not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	async remove(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[ANNOUNCEMENTS CONTROLLER] Remove announcement id=${id} for spaceId=${spaceId}`);

		await this.runOrRethrow(async () => this.announcementsService.remove(id, spaceId));
	}

	@ApiOperation({
		tags: [SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME],
		summary: 'Reorder announcements',
		description: 'Bulk reorder announcements within the signage info-panel space.',
		operationId: 'reorder-spaces-signage-info-panel-plugin-announcements',
	})
	@ApiParam({ name: 'spaceId', type: 'string', format: 'uuid', description: 'Signage space unique identifier' })
	@ApiBody({ type: ReqReorderAnnouncementsDto, description: 'Bulk reorder payload' })
	@ApiSuccessResponse(SignageAnnouncementsResponseModel, 'Announcements reordered successfully.')
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Signage space or announcement not found')
	@ApiUnprocessableEntityResponse('Announcements could not be reordered')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('reorder')
	async reorder(
		@Param('spaceId', new ParseUUIDPipe({ version: '4' })) spaceId: string,
		@Body() reorderDto: ReqReorderAnnouncementsDto,
	): Promise<SignageAnnouncementsResponseModel> {
		this.logger.debug(
			`[ANNOUNCEMENTS CONTROLLER] Reorder ${reorderDto.data.items.length} announcements for spaceId=${spaceId}`,
		);

		const announcements = await this.runOrRethrow(async () =>
			this.announcementsService.reorder(spaceId, reorderDto.data),
		);

		const response = new SignageAnnouncementsResponseModel();
		response.data = announcements;

		return response;
	}

	private async runOrRethrow<T>(work: () => Promise<T>): Promise<T> {
		try {
			return await work();
		} catch (error) {
			if (error instanceof SpacesSignageInfoPanelNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof SpacesSignageInfoPanelValidationException) {
				throw new UnprocessableEntityException(error.message);
			}
			throw error;
		}
	}
}
