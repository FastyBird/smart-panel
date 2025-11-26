import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	DEVICES_MODULE_API_TAG_DESCRIPTION,
	DEVICES_MODULE_API_TAG_NAME,
	DEVICES_MODULE_NAME,
	DEVICES_MODULE_PREFIX,
} from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity, ChannelEntity } from '../entities/devices.entity';
import { ChannelControlResponseModel, ChannelControlsResponseModel } from '../models/devices-response.model';
import { ChannelsControlsService } from '../services/channels.controls.service';
import { ChannelsService } from '../services/channels.service';

@ApiTag({
	tagName: DEVICES_MODULE_NAME,
	displayName: DEVICES_MODULE_API_TAG_NAME,
	description: DEVICES_MODULE_API_TAG_DESCRIPTION,
})
@Controller('channels/:channelId/controls')
export class ChannelsControlsController {
	private readonly logger = new Logger(ChannelsControlsController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsControlsService: ChannelsControlsService,
	) {}

	@Get()
	@ApiOperation({ summary: 'Retrieve all controls for a channel' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiSuccessResponse(ChannelControlsResponseModel)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async findAll(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelControlsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const controls = await this.channelsControlsService.findAll(channel.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${controls.length} controls for channelId=${channel.id}`);

		return toInstance(ChannelControlsResponseModel, { data: controls });
	}

	@Get(':id')
	@ApiOperation({ summary: 'Retrieve a specific control for a channel' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiSuccessResponse(ChannelControlResponseModel)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOneControl(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelControlResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching channel id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const control = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found control id=${control.id} for channelId=${channel.id}`);

		return toInstance(ChannelControlResponseModel, { data: control });
	}

	@Post()
	@ApiOperation({ summary: 'Create a new control for a channel' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiBody({ type: ReqCreateChannelControlDto })
	@ApiCreatedSuccessResponse(ChannelControlResponseModel)
	@ApiBadRequestResponse('Invalid UUID format or duplicate control name')
	@ApiNotFoundResponse('Channel not found')
	@ApiUnprocessableEntityResponse('Channel control could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/channels/:channel/controls/:id`)
	async create(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createControlDto: ReqCreateChannelControlDto,
	): Promise<ChannelControlResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create a new control for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const existingControl = await this.channelsControlsService.findOneByName(createControlDto.data.name, channel.id);

		if (existingControl === null) {
			throw ValidationExceptionFactory.createException([
				{
					property: 'controls',
					children: [
						{
							property: 'name',
							constraints: {
								unique: 'name must be unique',
							},
						},
					],
				},
			]);
		}

		try {
			const control = await this.channelsControlsService.create(channel.id, createControlDto.data);

			this.logger.debug(`[CREATE] Successfully created control id=${control.id} for channelId=${channel.id}`);

			return toInstance(ChannelControlResponseModel, { data: control });
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel control could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	@HttpCode(204)
	@ApiOperation({ summary: 'Delete a control for a channel' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiNoContentResponse({ description: 'Control deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async remove(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete control id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);
		const control = await this.getOneOrThrow(id, channel.id);

		await this.channelsControlsService.remove(control.id, channel.id);

		this.logger.debug(`[DELETE] Successfully deleted control id=${id} for channelId=${channel.id}`);
	}

	private async getOneOrThrow(id: string, channelId: string): Promise<ChannelControlEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of control id=${id} for channelId=${channelId}`);

		const control = await this.channelsControlsService.findOne(id, channelId);

		if (!control) {
			this.logger.error(`[ERROR] Control with id=${id} for channelId=${channelId} not found`);

			throw new NotFoundException('Requested channel control does not exist');
		}

		return control;
	}

	private async getChannelOrThrow(channelId: string): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of channel id=${channelId}`);

		const channel = await this.channelsService.findOne(channelId);

		if (!channel) {
			this.logger.error(`[ERROR] Channel with id=${channelId} not found`);

			throw new NotFoundException('Requested channel does not exist');
		}

		return channel;
	}
}
