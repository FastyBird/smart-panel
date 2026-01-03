import { validate } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_NAME, EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity } from '../entities/devices.entity';

@Injectable()
export class ChannelsControlsService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsControlsService');

	constructor(
		@InjectRepository(ChannelControlEntity)
		private readonly repository: Repository<ChannelControlEntity>,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(channelId: string): Promise<ChannelControlEntity[]> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('channel.id = :channelId', { channelId })
			.getMany();
	}

	async findOne(id: string, channelId: string): Promise<ChannelControlEntity | null> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('control.id = :id', { id })
			.andWhere('channel.id = :channelId', { channelId })
			.getOne();
	}

	async findOneByName(name: string, channelId: string): Promise<ChannelControlEntity | null> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.channel', 'channel')
			.where('control.name = :name', { name })
			.andWhere('channel.id = :channelId', { channelId })
			.getOne();
	}

	async create(channelId: string, createDto: CreateChannelControlDto): Promise<ChannelControlEntity> {
		this.logger.debug(`Creating new control for channelId=${channelId}`);

		const existingControl = await this.findOneByName(createDto.name, channelId);

		if (existingControl !== null) {
			throw new DevicesValidationException('Channel control name must be unique');
		}

		const dtoInstance = await this.validateDto<CreateChannelControlDto>(CreateChannelControlDto, createDto);

		const control = this.repository.create(
			toInstance(ChannelControlEntity, {
				...dtoInstance,
				channel: channelId,
			}),
		);
		await this.repository.save(control);

		const savedControl = await this.getOneOrThrow(control.id, channelId);

		this.logger.debug(`Successfully created control with id=${savedControl.id} for channelId=${channelId}`);

		this.eventEmitter.emit(EventType.CHANNEL_CONTROL_CREATED, savedControl);

		return savedControl;
	}

	async remove(id: string, channelId: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
		this.logger.debug(`Removing control with id=${id} for channelId=${channelId}`);

		const control = await manager.findOneOrFail<ChannelControlEntity>(ChannelControlEntity, {
			where: { id, channel: { id: channelId } },
		});

		// Capture control entity before removal to preserve ID for event emission
		const controlForEvent = { ...control };

		await manager.remove(control);

		this.logger.log(`Successfully removed control with id=${id} for channelId=${channelId}`);

		// Emit event with the control entity captured before removal to preserve ID
		this.eventEmitter.emit(EventType.CHANNEL_CONTROL_DELETED, controlForEvent);
	}

	async getOneOrThrow(id: string, channelId: string): Promise<ChannelControlEntity> {
		const control = await this.findOne(id, channelId);

		if (!control) {
			this.logger.error(`Control with id=${id} for channelId=${channelId} not found`);

			throw new DevicesNotFoundException('Channel control does not exist');
		}

		return control;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided control data are invalid.');
		}

		return dtoInstance;
	}
}
