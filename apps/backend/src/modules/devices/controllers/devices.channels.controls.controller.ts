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

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../api/decorators/api-documentation.decorator';
import { DEVICES_MODULE_NAME, DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceChannelControlDto } from '../dto/create-device-channel-control.dto';
import { ChannelControlEntity, ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelControlResponseModel, ChannelControlsResponseModel } from '../models/devices-response.model';
import { ChannelsControlsService } from '../services/channels.controls.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

@ApiTags(DEVICES_MODULE_NAME)
@Controller('devices/:deviceId/channels/:channelId/controls')
export class DevicesChannelsControlsController {
	private readonly logger = new Logger(DevicesChannelsControlsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsControlsService: ChannelsControlsService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_NAME],
		summary: 'Retrieve a list of all available controls for a device’s channel',
		description:
			'Fetches a list of controls associated with a specific channel of a device. Controls represent actions or commands that can be executed on the channel, such as reset or calibration.',
		operationId: 'get-devices-module-device-channel-controls',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiSuccessResponse(
		ChannelControlsResponseModel,
		'A list of controls successfully retrieved. Each control includes its metadata (ID, name, and timestamps).',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device or channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelControlsResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all data sources for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const dataSources = await this.channelsControlsService.findAll(channel.id);

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${dataSources.length} data sources for deviceId=${device.id} channelId=${channel.id}`,
		);

		const response = new ChannelControlsResponseModel();

		response.data = dataSources;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_NAME],
		summary: 'Retrieve details of a specific control for a device’s channel',
		description:
			'Fetches detailed information about a specific control associated with a device channel using its unique ID. The response includes metadata such as the control’s name, ID, associated channel, and timestamps.',
		operationId: 'get-devices-module-device-channel-control',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiSuccessResponse(
		ChannelControlResponseModel,
		'The control details were successfully retrieved. The response includes the control’s metadata (ID, name, and timestamps).',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device, channel, or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelControlResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const dataSource = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found channel id=${dataSource.id} for deviceId=${device.id} channelId=${channel.id}`);

		const response = new ChannelControlResponseModel();

		response.data = dataSource;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_NAME],
		summary: 'Create a new control for a specific device’s channel',
		description:
			'Creates a new control associated with a specific device channel. Controls represent actions or commands that can be executed on the channel, such as reset or calibration.',
		operationId: 'create-devices-module-device-channel-control',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiBody({ type: ReqCreateDeviceChannelControlDto, description: 'The data required to create a new channel control' })
	@ApiCreatedSuccessResponse(
		ChannelControlResponseModel,
		'The control was successfully created. The response includes the complete details of the newly created control, such as its unique identifier, name, associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or duplicate control name')
	@ApiNotFoundResponse('Device or channel not found')
	@ApiUnprocessableEntityResponse('Channel control could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:device/channels/:channel/controls/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: ReqCreateDeviceChannelControlDto,
	): Promise<ChannelControlResponseModel> {
		this.logger.debug(
			`[CREATE] Incoming request to create a new data source for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const existingControl = await this.channelsControlsService.findOneByName(createDto.data.name, channel.id);

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
			const dataSource = await this.channelsControlsService.create(channel.id, createDto.data);

			this.logger.debug(
				`[CREATE] Successfully created data source id=${dataSource.id} for deviceId=${device.id} channelId=${channel.id}`,
			);

			const response = new ChannelControlResponseModel();

			response.data = dataSource;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel control could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_NAME],
		summary: 'Create a new channel for a device',
		description:
			'Creates a new channel associated with a specific device. The channel can have attributes such as name, category, description, and optionally controls and properties.',
		operationId: 'create-devices-module-device-channel',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Control ID' })
	@ApiNoContentResponse({ description: 'Control deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device, channel, or control not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(
			`[DELETE] Incoming request to delete data source id=${id} for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);
		const control = await this.getOneOrThrow(id, channel.id);

		await this.channelsControlsService.remove(control.id, channel.id);

		this.logger.debug(
			`[DELETE] Successfully deleted channel id=${id} for deviceId=${device.id} channelId=${channel.id}`,
		);
	}

	private async getOneOrThrow(id: string, channelId: string): Promise<ChannelControlEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of data source id=${id} for channelId=${channelId}`);

		const control = await this.channelsControlsService.findOne(id, channelId);

		if (!control) {
			this.logger.error(`[ERROR] Data source with id=${id} for channelId=${channelId} not found`);

			throw new NotFoundException('Requested channel control does not exist');
		}

		return control;
	}

	private async getChannelOrThrow(deviceId: string, channelId: string): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of channel id=${channelId} for deviceId=${deviceId}`);

		const channel = await this.channelsService.findOne(channelId, deviceId);

		if (!channel) {
			this.logger.error(`[ERROR] Channel with id=${channelId} for deviceId=${deviceId} not found`);

			throw new NotFoundException('Requested channel control does not exist');
		}

		return channel;
	}

	private async getDeviceOrThrow(deviceId: string): Promise<DeviceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of device id=${deviceId}`);

		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${deviceId} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		return device;
	}
}
