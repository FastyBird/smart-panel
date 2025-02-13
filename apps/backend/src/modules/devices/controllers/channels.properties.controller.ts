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
import { ReqCreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { ReqUpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';

@Controller('channels/:channelId/properties')
export class ChannelsPropertiesController {
	private readonly logger = new Logger(ChannelsPropertiesController.name);

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
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
	@Header('Location', `:baseUrl/${DevicesModulePrefix}/channels/:channel/properties/:id`)
	async create(
		@Param('channelId', new ParseUUIDPipe({ version: '4' })) channelId: string,
		@Body() createDto: ReqCreateChannelPropertyDto,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[CREATE] Incoming request to create a new property for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		try {
			const property = await this.channelsPropertiesService.create(channel.id, createDto.data);

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
		@Body() updateDto: ReqUpdateChannelPropertyDto,
	): Promise<ChannelPropertyEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for property id=${id} for channelId=${channelId}`);

		const channel = await this.getChannelOrThrow(channelId);

		try {
			const updatedProperty = await this.channelsPropertiesService.update(id, updateDto.data);

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
