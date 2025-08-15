import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayInstanceDto } from '../dto/create-display-instance.dto';
import { UpdateDisplayInstanceDto } from '../dto/update-display-instance.dto';
import { DisplayInstanceEntity } from '../entities/users.entity';
import { EventType } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';

import { UsersService } from './users.service';

@Injectable()
export class DisplaysInstancesService {
	private readonly logger = new Logger(DisplaysInstancesService.name);

	constructor(
		@InjectRepository(DisplayInstanceEntity)
		private readonly repository: Repository<DisplayInstanceEntity>,
		private readonly usersService: UsersService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<DisplayInstanceEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays instances');

		const displays = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${displays.length} displays instances`);

		return displays;
	}

	async findOne(id: string, userId?: string): Promise<DisplayInstanceEntity | null> {
		let display: DisplayInstanceEntity | null;

		if (userId) {
			this.logger.debug(`[LOOKUP] Fetching display instance with id=${id} for userId=${userId}`);

			display = await this.repository
				.createQueryBuilder('display')
				.innerJoinAndSelect('display.user', 'user')
				.where('display.id = :id', { id })
				.andWhere('user.id = :userId', { userId })
				.getOne();

			if (!display) {
				this.logger.warn(`[LOOKUP] Display instance with id=${id} for userId=${userId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched display instance with id=${id} for userId=${userId}`);
		} else {
			display = await this.repository
				.createQueryBuilder('display')
				.innerJoinAndSelect('display.user', 'user')
				.where('display.id = :id', { id })
				.getOne();

			if (!display) {
				this.logger.warn(`[LOOKUP] Display instance with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched display instance with id=${id}`);
		}

		return display;
	}

	async findByUid(uid: string): Promise<DisplayInstanceEntity | null> {
		return this.findByField('uid', uid);
	}

	async findByMacAddress(macAddress: string): Promise<DisplayInstanceEntity | null> {
		return this.findByField('mac', macAddress);
	}

	async findForUser(userId: string): Promise<DisplayInstanceEntity | null> {
		return await this.repository
			.createQueryBuilder('display')
			.innerJoinAndSelect('display.user', 'user')
			.where('user.id = :userId', { userId })
			.getOne();
	}

	async create(userId: string, createDto: CreateDisplayInstanceDto): Promise<DisplayInstanceEntity> {
		this.logger.debug('[CREATE] Creating new display instance');

		const user = await this.usersService.getOneOrThrow(userId);

		const dtoInstance = await this.validateDto<CreateDisplayInstanceDto>(CreateDisplayInstanceDto, createDto);

		const display = this.repository.create(toInstance(DisplayInstanceEntity, { ...dtoInstance, user: user.id }));

		// Save the display
		await this.repository.save(display);

		// Retrieve the saved display with its full relations
		const savedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[CREATE] Successfully created display instance with id=${savedDisplay.id} for userId=${userId}`);

		this.eventEmitter.emit(EventType.DISPLAY_INSTANCE_CREATED, savedDisplay);

		return savedDisplay;
	}

	async update(id: string, updateDto: UpdateDisplayInstanceDto): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[UPDATE] Updating display instance with id=${id}`);

		const display = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateDisplayInstanceDto>(UpdateDisplayInstanceDto, updateDto);

		Object.assign(display, omitBy(toInstance(DisplayInstanceEntity, dtoInstance), isUndefined));

		await this.repository.save(display);

		const updatedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[UPDATE] Successfully updated display instance with id=${updatedDisplay.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_INSTANCE_UPDATED, updatedDisplay);

		return updatedDisplay;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing display instance with id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.repository.delete(display.id);

		this.logger.log(`[DELETE] Successfully removed display instance with id=${id}`);

		this.eventEmitter.emit(EventType.DISPLAY_INSTANCE_DELETED, display);
	}

	async getOneOrThrow(id: string): Promise<DisplayInstanceEntity> {
		const display = await this.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] Display instance with id=${id} not found`);

			throw new UsersNotFoundException('Requested display instance does not exist');
		}

		return display;
	}

	private async findByField(
		field: keyof DisplayInstanceEntity,
		value: string | number | boolean,
	): Promise<DisplayInstanceEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching display instance with ${field}=${value}`);

		const display = await this.repository
			.createQueryBuilder('display')
			.innerJoinAndSelect('display.user', 'user')
			.where(`display.${field} = :value`, { value })
			.getOne();

		if (!display) {
			this.logger.warn(`[LOOKUP] Display instance with ${field}=${value} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched display instance with ${field}=${value}`);

		return display;
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
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new UsersValidationException('Provided display instance data are invalid.');
		}

		return dtoInstance;
	}
}
