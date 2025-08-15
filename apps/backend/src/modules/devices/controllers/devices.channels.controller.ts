import { validate } from 'class-validator';

import {
	BadRequestException,
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

import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelTypeMapping, ChannelsTypeMapperService } from '../services/channels-type-mapper.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

@Controller('devices/:deviceId/channels')
export class DevicesChannelsController {
	private readonly logger = new Logger(DevicesChannelsController.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsMapperService: ChannelsTypeMapperService,
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
		@Body() createDto: { data: object },
	): Promise<ChannelEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new channel for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error(`[VALIDATION] Missing required field: type for deviceId=${device.id}`);

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Channel type attribute is required.' })]);
		}

		let mapping: ChannelTypeMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>;

		try {
			mapping = this.channelsMapperService.getMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported channel type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported channel type: ${type} for deviceId=${device.id}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = toInstance(
			mapping.createDto,
			{ ...createDto.data, device: device.id },
			{
				excludeExtraneousValues: false,
			},
		);

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
		@Body() updateDto: { data: object },
	): Promise<ChannelEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for channel id=${id} for deviceId=${deviceId}`);

		const device = await this.getDeviceOrThrow(deviceId);
		const channel = await this.getOneOrThrow(id, device.id);

		let mapping: ChannelTypeMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>;

		try {
			mapping = this.channelsMapperService.getMapping<ChannelEntity, CreateChannelDto, UpdateChannelDto>(channel.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported channel type for update: ${channel.type} id=${id} for deviceId=${deviceId}`,
				{
					message: err.message,
					stack: err.stack,
				},
			);

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
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)} id=${id} for deviceId=${deviceId}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedChannel = await this.channelsService.update(channel.id, dtoInstance);

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
