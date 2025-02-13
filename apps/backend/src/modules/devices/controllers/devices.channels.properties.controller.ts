import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { DevicesModulePrefix } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { ReqUpdateDeviceChannelPropertyDto } from '../dto/update-device-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices/:deviceId/channels/:channelId/properties')
export class DevicesChannelsPropertiesController {
	private readonly logger = new Logger(DevicesChannelsPropertiesController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelPropertyEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all data sources for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const properties = await this.channelsPropertiesService.findAll(channel.id);

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${properties.length} data sources for deviceId=${device.id} channelId=${channel.id}`,
		);

		return properties;
	}

	@Get(':id')
	async findOne(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const property = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found channel id=${property.id} for deviceId=${device.id} channelId=${channel.id}`);

		return property;
	}

	@Post()
	@Header('Location', `:baseUrl/${DevicesModulePrefix}/devices/:device/channels/:channel/properties/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: ReqCreateDeviceChannelPropertyDto,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(
			`[CREATE] Incoming request to create a new data source for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		try {
			const property = await this.channelsPropertiesService.create(channel.id, createDto.data);

			this.logger.debug(
				`[CREATE] Successfully created data source id=${property.id} for deviceId=${device.id} channelId=${channel.id}`,
			);

			return property;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel property could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDeviceChannelPropertyDto,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(
			`[UPDATE] Incoming update request for data source id=${id} for deviceId=${deviceId} channelId=${channelId}`,
		);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		try {
			const updatedProperty = await this.channelsPropertiesService.update(id, updateDto.data);

			this.logger.debug(
				`[UPDATE] Successfully updated channel id=${updatedProperty.id} for deviceId=${device.id} channelId=${channel.id}`,
			);

			return updatedProperty;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel property could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
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
