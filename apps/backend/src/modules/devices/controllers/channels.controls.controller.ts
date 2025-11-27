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
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../api/decorators/api-documentation.decorator';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DEVICES_MODULE_API_TAG_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity, ChannelEntity } from '../entities/devices.entity';
import { ChannelControlResponseModel, ChannelControlsResponseModel } from '../models/devices-response.model';
import { ChannelsControlsService } from '../services/channels.controls.service';
import { ChannelsService } from '../services/channels.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('channels/:channelId/controls')
export class ChannelsControlsController {
	private readonly logger = new Logger(ChannelsControlsController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsControlsService: ChannelsControlsService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of all available channel controls',
		description:
			'Fetches a list of all controls available for channels in the system. Each control represents an actionable operation associated with a channel. The response includes details such as the control’s ID, name, associated channel, and timestamps.',
		operationId: 'get-devices-module-channel-controls',
	})
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiSuccessResponse(
		ChannelControlsResponseModel,
		'A list of controls successfully retrieved. Each control includes its metadata (ID, name, and timestamps).',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelControlsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const controls = await this.channelsControlsService.findAll(channel.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${controls.length} controls for channelId=${channel.id}`);

		const response = new ChannelControlsResponseModel();

		response.data = controls;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific control for a channel',
		description:
			'Fetches the details of a specific control associated with a channel. The response includes the control’s unique identifier, name, associated channel, and metadata such as creation and update timestamps.',
		operationId: 'get-devices-module-channel-control',
	})
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiSuccessResponse(
		ChannelControlResponseModel,
		'The control details were successfully retrieved. The response includes the control’s metadata (ID, name, and timestamps).',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOneControl(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelControlResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching channel id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const control = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found control id=${control.id} for channelId=${channel.id}`);

		const response = new ChannelControlResponseModel();

		response.data = control;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Create a new control for a channel',
		description:
			'Allows the creation of a new control for a specific channel. A control represents an actionable operation or command associated with the channel. The response includes the complete details of the newly created control, including its ID, name, associated channel, and metadata.',
		operationId: 'create-devices-module-channel-control',
	})
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiBody({ type: ReqCreateChannelControlDto, description: 'The data required to create a new channel control' })
	@ApiCreatedSuccessResponse(
		ChannelControlResponseModel,
		'The control was successfully created. The response includes the complete details of the newly created control, such as its unique identifier, name, associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or duplicate control name')
	@ApiNotFoundResponse('Channel not found')
	@ApiUnprocessableEntityResponse('Channel control could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/channels/:channel/controls/:id`)
	@Post()
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

			const response = new ChannelControlResponseModel();

			response.data = control;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel control could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Delete a control for a channel',
		description:
			'Deletes a specific control associated with a channel using its unique ID. This operation is irreversible and permanently removes the control from the system.',
		operationId: 'delete-devices-module-channel-control',
	})
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiNoContentResponse({ description: 'Control deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
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
