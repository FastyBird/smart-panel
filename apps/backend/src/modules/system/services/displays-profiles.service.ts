import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayProfileDto } from '../dto/create-display-profile.dto';
import { UpdateDisplayProfileDto } from '../dto/update-display-profile.dto';
import { DisplayProfileEntity } from '../entities/system.entity';
import { EventType } from '../system.constants';
import { SystemNotFoundException, SystemValidationException } from '../system.exceptions';

@Injectable()
export class DisplaysProfilesService {
	private readonly logger = new Logger(DisplaysProfilesService.name);

	constructor(
		@InjectRepository(DisplayProfileEntity)
		private readonly repository: Repository<DisplayProfileEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<DisplayProfileEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays profiles');

		const displays = await this.repository.find();

		this.logger.debug(`[LOOKUP ALL] Found ${displays.length} displays profiles`);

		return displays;
	}

	async findOne(id: string): Promise<DisplayProfileEntity | null> {
		return this.findByField('id', id);
	}

	async findByUid(uid: string): Promise<DisplayProfileEntity | null> {
		return this.findByField('uid', uid);
	}

	async findPrimary(): Promise<DisplayProfileEntity | null> {
		return this.findByField('primary', true);
	}

	async create(createDto: CreateDisplayProfileDto): Promise<DisplayProfileEntity> {
		this.logger.debug('[CREATE] Creating new display profile');

		const dtoInstance = await this.validateDto<CreateDisplayProfileDto>(CreateDisplayProfileDto, createDto);

		if (dtoInstance.primary) {
			const primary = await this.findPrimary();

			if (primary !== null) {
				this.logger.error(
					`[PRIMARY CHECK FAILED] In the system is already registered primary display profile: ${primary.uid}`,
				);

				throw new SystemValidationException('Only one primary display profile is allowed.');
			}
		} else {
			const displays = await this.findAll();

			if (displays.length === 0) {
				dtoInstance.primary = true;
			}
		}

		const display = this.repository.create(toInstance(DisplayProfileEntity, dtoInstance));

		// Save the display
		await this.repository.save(display);

		// Retrieve the saved display with its full relations
		const savedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[CREATE] Successfully created display profile with id=${savedDisplay.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_PROFILE_CREATED, savedDisplay);

		return savedDisplay;
	}

	async update(id: string, updateDto: UpdateDisplayProfileDto): Promise<DisplayProfileEntity> {
		this.logger.debug(`[UPDATE] Updating display profile with id=${id}`);

		const display = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto<UpdateDisplayProfileDto>(UpdateDisplayProfileDto, updateDto);

		if (dtoInstance.primary) {
			const primary = await this.findPrimary();

			if (primary !== null && primary.id !== id) {
				this.logger.error(
					`[PRIMARY CHECK FAILED] In the system is already registered primary display profile: ${primary.uid}`,
				);

				throw new SystemValidationException('Only one primary display profile is allowed.');
			}
		}

		Object.assign(display, omitBy(toInstance(DisplayProfileEntity, dtoInstance), isUndefined));

		await this.repository.save(display);

		const updatedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`[UPDATE] Successfully updated display profile with id=${updatedDisplay.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_PROFILE_UPDATED, updatedDisplay);

		return updatedDisplay;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing display profile with id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.repository.delete(display.id);

		this.logger.log(`[DELETE] Successfully removed display profile with id=${id}`);

		this.eventEmitter.emit(EventType.DISPLAY_PROFILE_DELETED, display);
	}

	async getOneOrThrow(id: string): Promise<DisplayProfileEntity> {
		const display = await this.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] Display profile with id=${id} not found`);

			throw new SystemNotFoundException('Requested display profile does not exist');
		}

		return display;
	}

	private async findByField(
		field: keyof DisplayProfileEntity,
		value: string | number | boolean,
	): Promise<DisplayProfileEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching display profile with ${field}=${value}`);

		const display = await this.repository.findOne({ where: { [field]: value } });

		if (!display) {
			this.logger.warn(`[LOOKUP] Display profile with ${field}=${value} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched display profile with ${field}=${value}`);

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

			throw new SystemValidationException('Provided display profile data are invalid.');
		}

		return dtoInstance;
	}
}
