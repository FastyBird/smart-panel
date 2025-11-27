import { validate } from 'class-validator';

import {
	BadRequestException,
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
	Patch,
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
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DEVICES_MODULE_API_TAG_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto, ReqCreateChannelDto } from '../dto/create-channel.dto';
import { ReqUpdateChannelDto, UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';
import { ChannelResponseModel, ChannelsResponseModel } from '../models/devices-response.model';
import { ChannelTypeMapping, ChannelsTypeMapperService } from '../services/channels-type-mapper.service';
import { ChannelsService } from '../services/channels.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('channels')
export class ChannelsController {
	private readonly logger = new Logger(ChannelsController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsMapperService: ChannelsTypeMapperService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of available channels',
		description:
			'Fetches a list of channels in the system. The response includes metadata for each channel, such as its ID, name, category, associated device, controls, and properties.',
		operationId: 'get-devices-module-channels',
	})
	@ApiSuccessResponse(
		ChannelsResponseModel,
		'A list of channels successfully retrieved. Each channel includes its metadata (ID, name, category), associated device, controls, and properties.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<ChannelsResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all channels');

		const channels = await this.channelsService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${channels.length} channels`);

		const response = new ChannelsResponseModel();

		response.data = channels;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific channel',
		description:
			'Fetches detailed information about a specific channel using its unique ID. The response includes metadata, associated device information, controls, and properties for the channel.',
		operationId: 'get-devices-module-channel',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiSuccessResponse(
		ChannelResponseModel,
		'The channel details were successfully retrieved. The response includes the channel’s metadata (ID, name, category), associated device, controls, and properties.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ChannelResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching channel id=${id}`);

		const channel = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found channel id=${channel.id}`);

		const response = new ChannelResponseModel();

		response.data = channel;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Create a new channel',
		description:
			'Creates a new channel in the system. The channel can have attributes such as name, category, description, and an associated device. Optionally, controls and properties can also be defined during creation.',
		operationId: 'create-devices-module-channel',
	})
	@ApiBody({ type: ReqCreateChannelDto, description: 'The data required to create a new channel' })
	@ApiCreatedSuccessResponse(
		ChannelResponseModel,
		'The channel was successfully created. The response includes the complete details of the newly created channel, such as its unique identifier, name, category, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid request data or unsupported channel type')
	@ApiUnprocessableEntityResponse('Channel could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/channels/:id`)
	async create(@Body() createDto: { data: object }): Promise<ChannelResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new channel');

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Channel type attribute is required.' })]);
		}

		let mapping: ChannelTypeMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>;

		try {
			mapping = this.channelsMapperService.getMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported channel type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DevicesException) {
				throw new BadRequestException([JSON.stringify({ field: 'type', reason: `Unsupported channel type: ${type}` })]);
			}

			throw error;
		}

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for channel creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const channel = await this.channelsService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created channel id=${channel.id}`);

			const response = new ChannelResponseModel();

			response.data = channel;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Update an existing channel',
		description:
			'Partially updates the attributes of a specific channel using its unique ID. This allows modifications to properties such as the channel’s name, category, description, or associated controls and properties.',
		operationId: 'update-devices-module-channel',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiBody({ type: ReqUpdateChannelDto, description: 'The data required to update an existing channel' })
	@ApiSuccessResponse(
		ChannelResponseModel,
		'The channel was successfully updated. The response includes the complete details of the updated channel, such as its unique identifier, name, category, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or unsupported channel type')
	@ApiNotFoundResponse('Channel not found')
	@ApiUnprocessableEntityResponse('Channel could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<ChannelResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for channel id=${id}`);

		const channel = await this.getOneOrThrow(id);

		let mapping: ChannelTypeMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>;

		try {
			mapping = this.channelsMapperService.getMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>(channel.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported channel type for update: ${channel.type} id=${id} `, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported channel type: ${channel.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = toInstance(mapping.updateDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)} id=${id} `,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedChannel = await this.channelsService.update(channel.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated channel id=${updatedChannel.id}`);

			const response = new ChannelResponseModel();

			response.data = updatedChannel;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Delete a channel',
		description:
			'Deletes a specific channel using its unique ID. This operation is irreversible and permanently removes the channel from the system.',
		operationId: 'delete-devices-module-channel',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiNoContentResponse({ description: 'Channel deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete channel id=${id}`);

		const channel = await this.getOneOrThrow(id);

		await this.channelsService.remove(channel.id);

		this.logger.debug(`[DELETE] Successfully deleted channel id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of channel id=${id}`);

		const channel = await this.channelsService.findOne(id);

		if (!channel) {
			this.logger.error(`[ERROR] Channel with id=${id} not found`);

			throw new NotFoundException('Requested channel does not exist');
		}

		return channel;
	}
}
