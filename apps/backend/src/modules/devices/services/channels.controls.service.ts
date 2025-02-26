import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity } from '../entities/devices.entity';

import { ChannelsService } from './channels.service';

@Injectable()
export class ChannelsControlsService {
	private readonly logger = new Logger(ChannelsControlsService.name);

	constructor(
		@InjectRepository(ChannelControlEntity)
		private readonly repository: Repository<ChannelControlEntity>,
		private readonly channelsService: ChannelsService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(channelId: string): Promise<ChannelControlEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);

		const controls = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('channel.id = :channelId', { channelId: channel.id })
			.getMany();

		this.logger.debug(`[LOOKUP ALL] Found ${controls.length} controls for channelId=${channelId}`);

		return controls;
	}

	async findOne(id: string, channelId: string): Promise<ChannelControlEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching control with id=${id} for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);

		const control = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('control.id = :id', { id })
			.andWhere('channel.id = :channelId', { channelId: channel.id })
			.getOne();

		if (!control) {
			this.logger.warn(`[LOOKUP] Control with id=${id} for channelId=${channelId} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched control with id=${id} for channelId=${channelId}`);

		return control;
	}

	async findOneByName(name: string, channelId: string): Promise<ChannelControlEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching control with name=${name} for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);

		const control = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('control.name = :name', { name })
			.andWhere('channel.id = :channelId', { channelId: channel.id })
			.getOne();

		if (!control) {
			this.logger.warn(`[LOOKUP] Control with name=${name} for channelId=${channelId} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched control with name=${name} for channelId=${channelId}`);

		return control;
	}

	async create(channelId: string, createDto: CreateChannelControlDto): Promise<ChannelControlEntity> {
		this.logger.debug(`[CREATE] Creating new control for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);

		const existingControl = await this.findOneByName(createDto.name, channel.id);

		if (existingControl !== null) {
			throw new DevicesValidationException('Channel control name must be unique');
		}

		const dtoInstance = await this.validateDto<CreateChannelControlDto>(CreateChannelControlDto, createDto);

		const control = this.repository.create(
			plainToInstance(
				ChannelControlEntity,
				{
					...dtoInstance,
					channel: channel.id,
				},
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				},
			),
		);
		await this.repository.save(control);

		const savedControl = await this.getOneOrThrow(control.id, channel.id);

		this.logger.debug(`[CREATE] Successfully created control with id=${savedControl.id} for channelId=${channelId}`);

		this.eventEmitter.emit(EventType.CHANNEL_CONTROL_CREATED, savedControl);

		return savedControl;
	}

	async remove(id: string, channelId: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing control with id=${id} for channelId=${channelId}`);

		const channel = await this.channelsService.getOneOrThrow(channelId);
		const control = await this.getOneOrThrow(id, channel.id);

		await this.repository.remove(control);

		this.logger.log(`[DELETE] Successfully removed control with id=${id} for channelId=${channelId}`);

		this.eventEmitter.emit(EventType.CHANNEL_CONTROL_DELETED, control);
	}

	async getOneOrThrow(id: string, channelId: string): Promise<ChannelControlEntity> {
		const control = await this.findOne(id, channelId);

		if (!control) {
			this.logger.error(`[ERROR] Control with id=${id} for channelId=${channelId} not found`);

			throw new DevicesNotFoundException('Channel control does not exist');
		}

		return control;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided control data are invalid.');
		}

		return dtoInstance;
	}
}
