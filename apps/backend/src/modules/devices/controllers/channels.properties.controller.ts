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
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import {
	ChannelPropertyTypeMapping,
	ChannelsPropertiesTypeMapperService,
} from '../services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';

@Controller('channels/:channelId/properties')
export class ChannelsPropertiesController {
	private readonly logger = new Logger(ChannelsPropertiesController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsPropertiesMapperService: ChannelsPropertiesTypeMapperService,
	) {}

	@Get()
	async findAll(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
	): Promise<ChannelPropertyEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all properties for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const properties = await this.channelsPropertiesService.findAll(channel.id);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${properties.length} properties for channelId=${channel.id}`);

		return properties;
	}

	@Get(':id')
	async findOne(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[LOOKUP] Fetching channel id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const property = await this.getOneOrThrow(id, channel.id);

		this.logger.debug(`[LOOKUP] Found property id=${property.id} for channelId=${channel.id}`);

		return property;
	}

	@Post()
	@Header('Location', `:baseUrl/${DEVICES_MODULE_PREFIX}/channels/:channel/properties/:id`)
	async create(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: { data: object },
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new property for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error(`[VALIDATION] Missing required field: type for channelId=${channel.id}`);

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

			this.logger.error(`[ERROR] Unsupported channel property type: ${type} for channelId=${channel.id}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DevicesException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported channel property type: ${type}` }),
				]);
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
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for channel creation error=${JSON.stringify(errors)} for channelId=${channel.id}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const property = await this.channelsPropertiesService.create(channel.id, dtoInstance);

			this.logger.debug(`[CREATE] Successfully created property id=${property.id} for channelId=${channel.id}`);

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
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for property id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);
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
				`[ERROR] Unsupported channel property type for update: ${channel.type} id=${id} for channelId=${channelId}`,
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
				`[VALIDATION FAILED] Validation failed for device modification error=${JSON.stringify(errors)} id=${id} for channelId=${channelId}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedProperty = await this.channelsPropertiesService.update(property.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated property id=${updatedProperty.id} for channelId=${channel.id}`);

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
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete property id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		await this.channelsPropertiesService.remove(id);

		this.logger.debug(`[DELETE] Successfully deleted property id=${id} for channelId=${channel.id}`);
	}

	private async getOneOrThrow(id: string, channelId: string): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of property id=${id} for channelId=${channelId}`);

		const property = await this.channelsPropertiesService.findOne(id, channelId);

		if (!property) {
			this.logger.error(`[ERROR] Property with id=${id} for channelId=${channelId} not found`);

			throw new NotFoundException('Requested channel property does not exist');
		}

		return property;
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
