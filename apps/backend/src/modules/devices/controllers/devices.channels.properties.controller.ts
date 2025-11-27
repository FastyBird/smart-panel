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
	Query,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

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
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { ReqCreateDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { QueryPropertyTimeseriesDto } from '../dto/query-property-timeseries.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ReqUpdateDeviceChannelPropertyDto } from '../dto/update-device-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import {
	ChannelPropertiesResponseModel,
	ChannelPropertyResponseModel,
	PropertyTimeseriesResponseModel,
} from '../models/devices-response.model';
import {
	ChannelPropertyTypeMapping,
	ChannelsPropertiesTypeMapperService,
} from '../services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';
import { PropertyTimeseriesService } from '../services/property-timeseries.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('devices/:deviceId/channels/:channelId/properties')
export class DevicesChannelsPropertiesController {
	private readonly logger = new Logger(DevicesChannelsPropertiesController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsPropertiesMapperService: ChannelsPropertiesTypeMapperService,
		private readonly propertyTimeseriesService: PropertyTimeseriesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of all available properties for a device’s channel',
		description:
			'Fetches a list of properties associated with a specific channel of a device. Properties represent attributes or measurements related to the channel, such as thermostat mode, temperature, or humidity.',
		operationId: 'get-devices-module-device-channel-properties',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiSuccessResponse(
		ChannelPropertiesResponseModel,
		'A list of properties successfully retrieved. Each property includes its metadata (ID, name, category, data type, unit, and value), associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device or channel not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelPropertiesResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all data sources for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const properties = await this.channelsPropertiesService.findAll(channel.id);

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${properties.length} data sources for deviceId=${device.id} channelId=${channel.id}`,
		);

		const response = new ChannelPropertiesResponseModel();

		response.data = properties;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific property for a device’s channel',
		description:
			'Fetches detailed information about a specific property associated with a device channel using its unique ID. The response includes metadata such as the property’s name, category, value, and associated channel.',
		operationId: 'get-devices-module-device-channel-property',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Property ID' })
	@ApiSuccessResponse(
		ChannelPropertyResponseModel,
		'The property details were successfully retrieved. The response includes the property’s metadata (ID, name, category, data type, unit, and value), associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device, channel, or property not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelPropertyResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const property = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found channel id=${property.id} for deviceId=${device.id} channelId=${channel.id}`);

		const response = new ChannelPropertyResponseModel();

		response.data = property;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Get timeseries data for a specific property.',
		description:
			'Retrieves historical timeseries data for a property within a specified time range. Supports optional downsampling via bucket parameter. Returns empty array if no data exists.',
		operationId: 'get-devices-module-device-channel-property-timeseries',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Property ID' })
	@ApiQuery({ name: 'from', type: 'string', required: false, description: 'Start date (ISO 8601 format)' })
	@ApiQuery({ name: 'to', type: 'string', required: false, description: 'End date (ISO 8601 format)' })
	@ApiQuery({ name: 'bucket', type: 'string', required: false, description: 'Time bucket for aggregation' })
	@ApiSuccessResponse(
		PropertyTimeseriesResponseModel,
		'The timeseries data was successfully retrieved. The response includes the timeseries data for the property, including the timestamp, value, and metadata.',
	)
	@ApiBadRequestResponse('Invalid UUID format or invalid date format')
	@ApiNotFoundResponse('Device, channel, or property not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/timeseries')
	async getTimeseries(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Query() query: QueryPropertyTimeseriesDto,
	): Promise<PropertyTimeseriesResponseModel> {
		this.logger.debug(
			`[TIMESERIES] Fetching timeseries for property id=${id} deviceId=${deviceId} channelId=${channelId} from=${query.from ?? 'default'} to=${query.to ?? 'default'} bucket=${query.bucket ?? 'auto'}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);
		const property = await this.getOneOrThrow(id, channel.id);

		// Determine time range: use query params or default to last 24 hours
		const to = query.to ? new Date(query.to) : new Date();
		const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);

		if (isNaN(from.getTime())) {
			throw new BadRequestException([JSON.stringify({ field: 'from', reason: 'Invalid date format.' })]);
		}

		if (isNaN(to.getTime())) {
			throw new BadRequestException([JSON.stringify({ field: 'to', reason: 'Invalid date format.' })]);
		}

		const result = await this.propertyTimeseriesService.queryTimeseries(property, from, to, query.bucket);

		this.logger.debug(
			`[TIMESERIES] Retrieved ${result.points.length} points for property id=${property.id} deviceId=${device.id} channelId=${channel.id}`,
		);

		const response = new PropertyTimeseriesResponseModel();

		response.data = result;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Create a new property for a specific device’s channel',
		description:
			'Creates a new property for a specific device channel. The property can include metadata such as category, permissions, data type, unit, and initial value. The response contains the full representation of the created property, including its unique identifier, associated channel, and metadata.',
		operationId: 'create-devices-module-device-channel-property',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiBody({ type: ReqCreateDeviceChannelPropertyDto, description: 'The data required to create a new property' })
	@ApiCreatedSuccessResponse(
		ChannelPropertyResponseModel,
		'The property was successfully created. The response includes the complete details of the newly created property, such as its unique identifier, name, category, data type, unit, and value, associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format, invalid request data, or unsupported property type')
	@ApiNotFoundResponse('Device or channel not found')
	@ApiUnprocessableEntityResponse('Channel property could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:device/channels/:channel/properties/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: { data: object },
	): Promise<ChannelPropertyResponseModel> {
		this.logger.debug(
			`[CREATE] Incoming request to create a new data source for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error(`[VALIDATION] Missing required field: type for deviceId=${device.id} channelId=${channel.id}`);

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Channel property type attribute is required.' }),
			]);
		}

		let mapping: ChannelPropertyTypeMapping<ChannelPropertyEntity, CreateChannelPropertyDto, UpdateChannelPropertyDto>;

		try {
			mapping = this.channelsPropertiesMapperService.getMapping<
				ChannelPropertyEntity,
				CreateChannelPropertyDto,
				UpdateChannelPropertyDto
			>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported channel property type: ${type} for deviceId=${device.id} channelId=${channel.id}`,
				{ message: err.message, stack: err.stack },
			);

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported channel property type: ${type}` }),
				]);
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
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for channel creation error=${JSON.stringify(errors)} for deviceId=${device.id} channelId=${channel.id}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const property = await this.channelsPropertiesService.create(channel.id, dtoInstance);

			this.logger.debug(
				`[CREATE] Successfully created data source id=${property.id} for deviceId=${device.id} channelId=${channel.id}`,
			);

			const response = new ChannelPropertyResponseModel();

			response.data = property;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel property could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Update and existing property for a specific device’s channel',
		description:
			'Partially updates the details of a specific property associated with a device channel. This operation allows modifications to attributes such as the property’s name, value, or metadata, while preserving its unique identifier and association with the channel.',
		operationId: 'update-devices-module-device-channel-property',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Property ID' })
	@ApiBody({ type: ReqUpdateDeviceChannelPropertyDto, description: 'The data required to update an existing property' })
	@ApiSuccessResponse(
		ChannelPropertyResponseModel,
		'The property was successfully updated. The response includes the complete details of the updated property, such as its unique identifier, name, category, data type, unit, and value, associated channel, and timestamps.',
	)
	@ApiBadRequestResponse('Invalid UUID format or unsupported property type')
	@ApiNotFoundResponse('Device, channel, or property not found')
	@ApiUnprocessableEntityResponse('Channel property could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<ChannelPropertyResponseModel> {
		this.logger.debug(
			`[UPDATE] Incoming update request for data source id=${id} for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);
		const property = await this.getOneOrThrow(id, channel.id);

		let mapping: ChannelPropertyTypeMapping<ChannelPropertyEntity, CreateChannelPropertyDto, UpdateChannelPropertyDto>;

		try {
			mapping = this.channelsPropertiesMapperService.getMapping<
				ChannelPropertyEntity,
				CreateChannelPropertyDto,
				UpdateChannelPropertyDto
			>(property.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported channel property type for update: ${channel.type} id=${id} for deviceId=${device.id} channelId=${channelId}`,
				{
					message: err.message,
					stack: err.stack,
				},
			);

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported channel property type: ${channel.type}` }),
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
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)} id=${id} for deviceId=${device.id} channelId=${channelId}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedProperty = await this.channelsPropertiesService.update(property.id, dtoInstance);

			this.logger.debug(
				`[UPDATE] Successfully updated channel id=${updatedProperty.id} for deviceId=${device.id} channelId=${channel.id}`,
			);

			const response = new ChannelPropertyResponseModel();

			response.data = updatedProperty;

			return response;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel property could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Delete a property for a device channel',
		description:
			'Deletes a specific property associated with a device channel using its unique ID. This operation is irreversible and permanently removes the property from the system.',
		operationId: 'delete-devices-module-device-channel-property',
	})
	@ApiParam({ name: 'deviceId', type: 'string', format: 'uuid', description: 'Device ID' })
	@ApiParam({ name: 'channelId', type: 'string', format: 'uuid', description: 'Channel ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Property ID' })
	@ApiNoContentResponse({ description: 'Property deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device, channel, or property not found')
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
		const property = await this.getOneOrThrow(id, channel.id);

		await this.channelsPropertiesService.remove(property.id);

		this.logger.debug(
			`[DELETE] Successfully deleted channel id=${id} for deviceId=${device.id} channelId=${channel.id}`,
		);
	}

	private async getOneOrThrow(id: string, channelId: string): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of data source id=${id} for channelId=${channelId}`);

		const property = await this.channelsPropertiesService.findOne(id, channelId);

		if (!property) {
			this.logger.error(`[ERROR] Data source with id=${id} for channelId=${channelId} not found`);

			throw new NotFoundException('Requested channel property does not exist');
		}

		return property;
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
