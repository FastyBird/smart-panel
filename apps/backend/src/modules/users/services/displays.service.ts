import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateDisplayDto } from '../dto/create-display.dto';
import { UpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayEntity } from '../entities/users.entity';
import { EventType } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';

import { UsersService } from './users.service';

@Injectable()
export class DisplaysService {
	private readonly logger = new Logger(DisplaysService.name);

	constructor(
		@InjectRepository(DisplayEntity)
		private readonly repository: Repository<DisplayEntity>,
		private readonly usersService: UsersService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<DisplayEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays');

		const displays = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${displays.length} displays`);

		return displays;
	}

	async findOne(id: string, userId?: string): Promise<DisplayEntity | null> {
		let display: DisplayEntity | null;

		if (userId) {
			this.logger.debug(`[LOOKUP] Fetching property with id=${id} for userId=${userId}`);

			display = await this.repository
				.createQueryBuilder('display')
				.innerJoinAndSelect('display.user', 'user')
				.where('display.id = :id', { id })
				.andWhere('user.id = :userId', { userId })
				.getOne();

			if (!display) {
				this.logger.warn(`[LOOKUP] Display with id=${id} for userId=${userId} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched display with id=${id} for userId=${userId}`);
		} else {
			display = await this.repository
				.createQueryBuilder('display')
				.innerJoinAndSelect('display.user', 'user')
				.where('display.id = :id', { id })
				.getOne();

			if (!display) {
				this.logger.warn(`[LOOKUP] Display with id=${id} not found`);

				return null;
			}

			this.logger.debug(`[LOOKUP] Successfully fetched display with id=${id}`);
		}

		return display;
	}

	async findByMacAddress(macAddress: string): Promise<DisplayEntity | null> {
		return this.findByField('mac', macAddress);
	}

	async findForUser(userId: string): Promise<DisplayEntity | null> {
		return await this.repository
			.createQueryBuilder('display')
			.innerJoinAndSelect('display.user', 'user')
			.where('user.id = :userId', { userId })
			.getOne();
	}

	async create(userId: string, createDto: CreateDisplayDto): Promise<DisplayEntity> {
		this.logger.debug('[CREATE] Creating new display');

		const user = await this.usersService.getOneOrThrow(userId);

		const dtoInstance = await this.validateDto<CreateDisplayDto>(CreateDisplayDto, createDto);

		const display = this.repository.create(
			plainToInstance(
				DisplayEntity,
				{ ...dtoInstance, user: user.id },
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
					groups: ['internal'],
				},
			),
		);

		// Save the display
		await this.repository.save(display);

		// Retrieve the saved display with its full relations
		const savedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[CREATE] Successfully created display with id=${savedDisplay.id} for userId=${userId}`);

		this.eventEmitter.emit(EventType.DISPLAY_CREATED, savedDisplay);

		return savedDisplay;
	}

	async update(id: string, updateDto: UpdateDisplayDto): Promise<DisplayEntity> {
		this.logger.debug(`[UPDATE] Updating display with id=${id}`);

		const display = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateDisplayDto>(UpdateDisplayDto, updateDto);

		Object.assign(
			display,
			omitBy(
				plainToInstance(
					DisplayEntity,
					{ ...dtoInstance },
					{
						enableImplicitConversion: true,
						excludeExtraneousValues: true,
						exposeDefaultValues: false,
						groups: ['internal'],
					},
				),
				isUndefined,
			),
		);

		await this.repository.save(display);

		const updatedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[UPDATE] Successfully updated display with id=${updatedDisplay.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_UPDATED, updatedDisplay);

		return updatedDisplay;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing display with id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.repository.delete(display.id);

		this.logger.log(`[DELETE] Successfully removed display with id=${id}`);

		this.eventEmitter.emit(EventType.DISPLAY_DELETED, display);
	}

	async getOneOrThrow(id: string): Promise<DisplayEntity> {
		const display = await this.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] Display with id=${id} not found`);

			throw new UsersNotFoundException('Requested display does not exist');
		}

		return display;
	}

	private async findByField(
		field: keyof DisplayEntity,
		value: string | number | boolean,
	): Promise<DisplayEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching display with ${field}=${value}`);

		const display = await this.repository
			.createQueryBuilder('display')
			.innerJoinAndSelect('display.user', 'user')
			.where(`display.${field} = :value`, { value })
			.getOne();

		if (!display) {
			this.logger.warn(`[LOOKUP] Display with ${field}=${value} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched display with ${field}=${value}`);

		return display;
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

			throw new UsersValidationException('Provided display data are invalid.');
		}

		return dtoInstance;
	}
}
