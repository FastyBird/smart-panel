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

import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceChannelDto } from '../dto/create-device-channel.dto';
import { ReqUpdateDeviceChannelDto } from '../dto/update-device-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices/:deviceId/channels')
export class DevicesChannelsController {
	private readonly logger = new Logger(DevicesChannelsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
	) {}

	@Get()
	async findAll(@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string): Promise<ChannelEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all channels for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const channels = await this.channelsService.findAll(device.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${channels.length} channels for deviceId=${device.id}`);

		return channels;
	}

	@Get(':id')
	async findOne(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const channel = await this.getOneOrThrow(id, device.id);

		this.logger.debug(`[LOOKUP] Found channel id=${channel.id} for deviceId=${device.id}`);

		return channel;
	}

	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/devices/:device/channels/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Body() createDto: ReqCreateDeviceChannelDto,
	): Promise<ChannelEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new channel for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		try {
			const channel = await this.channelsService.create({ ...createDto.data, device: device.id });

			this.logger.debug(`[CREATE] Successfully created channel id=${channel.id} for deviceId=${device.id}`);

			return channel;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDeviceChannelDto,
	): Promise<ChannelEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for channel id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getOneOrThrow(id, device.id);

		try {
			const updatedChannel = await this.channelsService.update(channel.id, updateDto.data);

			this.logger.debug(`[UPDATE] Successfully updated channel id=${updatedChannel.id} for deviceId=${device.id}`);

			return updatedChannel;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete channel id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getOneOrThrow(id, device.id);

		await this.channelsService.remove(channel.id);

		this.logger.debug(`[DELETE] Successfully deleted channel id=${id} for deviceId=${device.id}`);
	}

	private async getOneOrThrow(id: string, deviceId: string): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of channel id=${id} for deviceId=${deviceId}`);

		const channel = await this.channelsService.findOne(id, deviceId);

		if (!channel) {
			this.logger.error(`[ERROR] Channel with id=${id} for deviceId=${deviceId} not found`);

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
