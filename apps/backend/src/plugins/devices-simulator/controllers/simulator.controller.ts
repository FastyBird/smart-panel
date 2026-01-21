import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesNotFoundException } from '../../../modules/devices/devices.exceptions';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceResponseModel } from '../../../modules/devices/models/devices-response.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getAllProperties, getDeviceSpec } from '../../../modules/devices/utils/schema.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_SIMULATOR_PLUGIN_API_TAG_NAME,
	DEVICES_SIMULATOR_PLUGIN_NAME,
	DEVICES_SIMULATOR_TYPE,
} from '../devices-simulator.constants';
import { ReqGenerateDeviceDto } from '../dto/generate-device.dto';
import { ReqSimulateConnectionStateDto, ReqSimulateValueDto } from '../dto/simulate-value.dto';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import {
	ConnectionStateResponseModel,
	ConnectionStateResultModel,
	DeviceCategoriesResponseModel,
	DeviceCategoryModel,
	SimulatedValueResponseModel,
	SimulatedValueResultModel,
} from '../models/simulator-response.model';
import { DeviceGeneratorService } from '../services/device-generator.service';

@ApiTags(DEVICES_SIMULATOR_PLUGIN_API_TAG_NAME)
@Controller('simulator')
export class SimulatorController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'SimulatorController',
	);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly deviceGeneratorService: DeviceGeneratorService,
	) {}

	@ApiOperation({
		summary: 'Get available device categories',
		description:
			'Returns a list of all device categories that can be used to generate simulated devices with their descriptions.',
		operationId: 'get-devices-simulator-plugin-categories',
	})
	@ApiSuccessResponse(DeviceCategoriesResponseModel, 'List of available device categories')
	@Get('categories')
	getCategories(): DeviceCategoriesResponseModel {
		this.logger.debug('Fetching available device categories');

		const categories: DeviceCategoryModel[] = [];

		for (const category of Object.values(DeviceCategory)) {
			const spec = getDeviceSpec(category);

			categories.push({
				category,
				name: this.formatCategoryName(category),
				description: spec?.description?.en || '',
			});
		}

		return toInstance(DeviceCategoriesResponseModel, { data: categories }, { excludeExtraneousValues: true });
	}

	@ApiOperation({
		summary: 'Generate a simulated device',
		description:
			'Generates a new simulated device with all channels and properties based on the device category specification. The device can optionally auto-simulate value changes.',
		operationId: 'create-devices-simulator-plugin-device',
	})
	@ApiBody({
		type: ReqGenerateDeviceDto,
		description: 'Device generation parameters',
	})
	@ApiCreatedSuccessResponse(DeviceResponseModel, 'The generated simulated device')
	@ApiBadRequestResponse('Invalid device generation parameters')
	@ApiInternalServerErrorResponse('Failed to generate device')
	@Post('generate')
	async generateDevice(@Body() body: ReqGenerateDeviceDto): Promise<DeviceResponseModel> {
		const dto = body.data;

		this.logger.log(`Generating simulated ${dto.category} device: ${dto.name}`);

		const generatedData = this.deviceGeneratorService.generateDevice(dto);

		// Create the device using the devices service
		const device = await this.devicesService.create<SimulatorDeviceEntity, any>({
			...generatedData,
		});

		// Set initial connection state to connected
		await this.deviceConnectivityService.setConnectionState(device.id, {
			state: ConnectionState.CONNECTED,
			reason: 'Simulator device created',
		});

		this.logger.log(`Successfully generated simulated device id=${device.id}`, { resource: device.id });

		return toInstance(DeviceResponseModel, { data: device }, { excludeExtraneousValues: true });
	}

	@ApiOperation({
		summary: 'Simulate a property value change',
		description:
			'Sets a new value for a property on a simulated device. If no value is provided, a random value based on the property type will be generated.',
		operationId: 'simulate-devices-simulator-plugin-property-value',
	})
	@ApiParam({
		name: 'deviceId',
		description: 'Device UUID',
		type: 'string',
		format: 'uuid',
	})
	@ApiBody({
		type: ReqSimulateValueDto,
		description: 'Property value simulation parameters',
	})
	@ApiSuccessResponse(SimulatedValueResponseModel, 'Value simulation result')
	@ApiNotFoundResponse('Device or property not found')
	@ApiBadRequestResponse('Invalid simulation parameters or device is not a simulator device')
	@Post(':deviceId/simulate-value')
	async simulateValue(
		@Param('deviceId', ParseUUIDPipe) deviceId: string,
		@Body() body: ReqSimulateValueDto,
	): Promise<SimulatedValueResponseModel> {
		const dto = body.data;

		this.logger.debug(`Simulating value for device=${deviceId}, property=${dto.property_id}`);

		// Verify the device exists and is a simulator device
		const device = await this.devicesService.findOne<SimulatorDeviceEntity>(deviceId, DEVICES_SIMULATOR_TYPE);

		if (!device) {
			throw new DevicesNotFoundException(`Simulator device ${deviceId} not found`);
		}

		// Find the property
		const property = await this.channelsPropertiesService.findOne(dto.property_id);

		if (!property) {
			throw new DevicesNotFoundException(`Property ${dto.property_id} not found`);
		}

		// Verify the property belongs to the specified device
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel.id;
		const propertyBelongsToDevice = device.channels.some((ch) => ch.id === channelId);

		if (!propertyBelongsToDevice) {
			throw new DevicesNotFoundException(`Property ${dto.property_id} does not belong to device ${deviceId}`);
		}

		// Generate value if not provided
		let value = dto.value;

		if (value === undefined) {
			// Get property metadata from schema
			// property.channel can be a string (id) or ChannelEntity
			const channelCategory = typeof property.channel === 'string' ? null : property.channel.category;

			if (channelCategory) {
				const allProperties = getAllProperties(channelCategory);
				const propMeta = allProperties.find((p) => p.category === property.category);

				if (propMeta) {
					value = this.deviceGeneratorService.generateRandomValue(propMeta);
				}
			}
		}

		if (value === null || value === undefined) {
			value = true; // Default fallback
		}

		// Update the property value
		await this.channelsPropertiesService.update(property.id, {
			type: property.type,
			value,
		});

		this.logger.log(`Simulated value for property=${dto.property_id}: ${value}`, { resource: deviceId });

		const result: SimulatedValueResultModel = {
			property_id: dto.property_id,
			value,
			success: true,
		};

		return toInstance(SimulatedValueResponseModel, { data: result }, { excludeExtraneousValues: true });
	}

	@ApiOperation({
		summary: 'Simulate device connection state',
		description:
			'Changes the connection state of a simulated device (e.g., connected, disconnected, lost). This is useful for testing how the UI handles connection changes.',
		operationId: 'simulate-devices-simulator-plugin-connection-state',
	})
	@ApiParam({
		name: 'deviceId',
		description: 'Device UUID',
		type: 'string',
		format: 'uuid',
	})
	@ApiBody({
		type: ReqSimulateConnectionStateDto,
		description: 'Connection state simulation parameters',
	})
	@ApiSuccessResponse(ConnectionStateResponseModel, 'Connection state simulation result')
	@ApiNotFoundResponse('Device not found')
	@ApiBadRequestResponse('Invalid state or device is not a simulator device')
	@Post(':deviceId/simulate-connection')
	async simulateConnectionState(
		@Param('deviceId', ParseUUIDPipe) deviceId: string,
		@Body() body: ReqSimulateConnectionStateDto,
	): Promise<ConnectionStateResponseModel> {
		const dto = body.data;

		this.logger.debug(`Simulating connection state for device=${deviceId}: ${dto.state}`);

		// Verify the device exists and is a simulator device
		const device = await this.devicesService.findOne<SimulatorDeviceEntity>(deviceId, DEVICES_SIMULATOR_TYPE);

		if (!device) {
			throw new DevicesNotFoundException(`Simulator device ${deviceId} not found`);
		}

		// Update the connection state
		await this.deviceConnectivityService.setConnectionState(deviceId, {
			state: dto.state,
			reason: `Simulated state change to ${dto.state}`,
		});

		this.logger.log(`Simulated connection state for device=${deviceId}: ${dto.state}`, { resource: deviceId });

		const result: ConnectionStateResultModel = {
			device_id: deviceId,
			state: dto.state,
			success: true,
		};

		return toInstance(ConnectionStateResponseModel, { data: result }, { excludeExtraneousValues: true });
	}

	@ApiOperation({
		summary: 'Simulate random values for all properties',
		description:
			'Generates and sets random values for all properties of a simulated device. This is useful for quick testing of UI updates.',
		operationId: 'simulate-devices-simulator-plugin-all-values',
	})
	@ApiParam({
		name: 'deviceId',
		description: 'Device UUID',
		type: 'string',
		format: 'uuid',
	})
	@ApiSuccessResponse(DeviceResponseModel, 'The device with updated values')
	@ApiNotFoundResponse('Device not found')
	@ApiBadRequestResponse('Device is not a simulator device')
	@Post(':deviceId/simulate-all')
	async simulateAllValues(@Param('deviceId', ParseUUIDPipe) deviceId: string): Promise<DeviceResponseModel> {
		this.logger.debug(`Simulating all values for device=${deviceId}`);

		// Verify the device exists and is a simulator device
		const device = await this.devicesService.findOne<SimulatorDeviceEntity>(deviceId, DEVICES_SIMULATOR_TYPE);

		if (!device) {
			throw new DevicesNotFoundException(`Simulator device ${deviceId} not found`);
		}

		// Update all properties with random values
		for (const channel of device.channels) {
			const allProperties = getAllProperties(channel.category);

			for (const property of channel.properties) {
				const propMeta = allProperties.find((p) => p.category === property.category);

				if (propMeta) {
					const value = this.deviceGeneratorService.generateRandomValue(propMeta);

					if (value !== null) {
						await this.channelsPropertiesService.update(property.id, {
							type: property.type,
							value,
						});
					}
				}
			}
		}

		// Reload the device to get updated values
		const updatedDevice = await this.devicesService.findOne<DeviceEntity>(deviceId);

		if (!updatedDevice) {
			throw new DevicesNotFoundException(`Simulator device ${deviceId} not found`);
		}

		this.logger.log(`Simulated all values for device=${deviceId}`, { resource: deviceId });

		return toInstance(DeviceResponseModel, { data: updatedDevice }, { excludeExtraneousValues: true });
	}

	/**
	 * Format category enum to human-readable name
	 */
	private formatCategoryName(category: DeviceCategory): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
}
