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
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DevicesModulePrefix } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { ReqCreateDeviceChannelControlDto } from '../dto/create-device-channel-control.dto';
import { ChannelControlEntity, ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsControlsService } from '../services/channels.controls.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices/:deviceId/channels/:channelId/controls')
export class DevicesChannelsControlsController {
	private readonly logger = new Logger(DevicesChannelsControlsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsControlsService: ChannelsControlsService,
	) {}

	@Get()
	async findAll(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelControlEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all data sources for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const dataSources = await this.channelsControlsService.findAll(channel.id);

		this.logger.debug(
			`[LOOKUP ALL] Retrieved ${dataSources.length} data sources for deviceId=${device.id} channelId=${channel.id}`,
		);

		return dataSources;
	}

	@Get(':id')
	async findOne(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelControlEntity> {
		this.logger.debug(`[LOOKUP] Fetching device id=${id} for deviceId=${deviceId} channelId=${channelId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getChannelOrThrow(device.id, channelId);

		const dataSource = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found channel id=${dataSource.id} for deviceId=${device.id} channelId=${channel.id}`);

		return dataSource;
	}

	@Post()
	@Header('Location', `:baseUrl/${DevicesModulePrefix}/devices/:device/channels/:channel/controls/:id`)
	async create(
		@Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: ReqCreateDeviceChannelControlDto,
	): Promise<ChannelControlEntity> {
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

			return dataSource;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel control could not be created. Please try again later');
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
