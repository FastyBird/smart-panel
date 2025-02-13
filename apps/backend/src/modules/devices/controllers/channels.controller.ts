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
import { ReqCreateChannelDto } from '../dto/create-channel.dto';
import { ReqUpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';
import { ChannelsService } from '../services/channels.service';

@Controller('channels')
export class ChannelsController {
	private readonly logger = new Logger(ChannelsController.name);

	constructor(private readonly channelsService: ChannelsService) {}

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
	@Header('Location', `:baseUrl/${DevicesModulePrefix}/channels/:id`)
	async create(@Body() createDto: ReqCreateChannelDto): Promise<ChannelEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new channel');

		try {
			const channel = await this.channelsService.create(createDto.data);

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
		@Body() updateDto: ReqUpdateChannelDto,
	): Promise<ChannelEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for channel id=${id}`);

		const channel = await this.getOneOrThrow(id);

		try {
			const updatedChannel = await this.channelsService.update(channel.id, updateDto.data);

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
