import { plainToInstance } from 'class-transformer';
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

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';
import { ChannelTypeMapping, ChannelsTypeMapperService } from '../services/channels-type-mapper.service';
import { ChannelsService } from '../services/channels.service';

@Controller('channels')
export class ChannelsController {
	private readonly logger = new Logger(ChannelsController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsMapperService: ChannelsTypeMapperService,
	) {}

	// Channels
	@Get()
	async findAll(): Promise<ChannelEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all channels');

		const channels = await this.channelsService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${channels.length} channels`);

		return channels;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ChannelEntity> {
		this.logger.debug(`[LOOKUP] Fetching channel id=${id}`);

		const channel = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found channel id=${channel.id}`);

		return channel;
	}

	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/channels/:id`)
	async create(@Body() createDto: { data: object }): Promise<ChannelEntity> {
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

		const dtoInstance = plainToInstance(mapping.createDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for channel creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const channel = await this.channelsService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created channel id=${channel.id}`);

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
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<ChannelEntity> {
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

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
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

			return updatedChannel;
		} catch (error) {
			if (error instanceof DevicesException) {
				throw new UnprocessableEntityException('Channel could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
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
