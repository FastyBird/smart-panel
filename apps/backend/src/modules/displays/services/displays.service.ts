import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DISPLAYS_MODULE_NAME, EventType } from '../displays.constants';
import { DisplaysNotFoundException, DisplaysValidationException } from '../displays.exceptions';
import { UpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplaysService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplaysService');

	constructor(
		@InjectRepository(DisplayEntity)
		private readonly repository: Repository<DisplayEntity>,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<DisplayEntity[]> {
		this.logger.debug('Fetching all displays');

		const displays = await this.repository.find();

		this.logger.debug(`Found ${displays.length} displays`);

		return displays;
	}

	async findOne(id: string): Promise<DisplayEntity | null> {
		return this.findByField('id', id);
	}

	async findByMacAddress(macAddress: string): Promise<DisplayEntity | null> {
		return this.findByField('macAddress', macAddress);
	}

	async findByRegisteredFromIp(ip: string): Promise<DisplayEntity | null> {
		return this.findByField('registeredFromIp', ip);
	}

	async getOneOrThrow(id: string): Promise<DisplayEntity> {
		const display = await this.findOne(id);

		if (!display) {
			this.logger.error(`Display with id=${id} not found`);

			throw new DisplaysNotFoundException('Requested display does not exist');
		}

		return display;
	}

	async create(data: Partial<DisplayEntity>): Promise<DisplayEntity> {
		this.logger.debug('Creating new display');

		const display = this.repository.create(data);

		await this.repository.save(display);

		// Re-fetch to get database default values populated
		const savedDisplay = await this.getOneOrThrow(display.id);

		this.logger.debug(`Successfully created display with id=${savedDisplay.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_CREATED, savedDisplay);

		return savedDisplay;
	}

	async update(id: string, updateDto: UpdateDisplayDto): Promise<DisplayEntity> {
		this.logger.debug(`Updating display with id=${id}`);

		const display = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto(UpdateDisplayDto, updateDto);

		Object.assign(display, omitBy(toInstance(DisplayEntity, dtoInstance), isUndefined));

		// Explicitly handle space_id being set to null (toInstance with exposeUnsetFields:false drops null values)
		if (dtoInstance.space_id === null) {
			display.spaceId = null;
		}

		// Explicitly handle home_page_id being set to null
		if (dtoInstance.home_page_id === null) {
			display.homePageId = null;
		}

		await this.repository.save(display);

		this.logger.debug(`Successfully updated display with id=${display.id}`);

		this.eventEmitter.emit(EventType.DISPLAY_UPDATED, display);

		return display;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing display with id=${id}`);

		const display = await this.getOneOrThrow(id);

		// Explicitly clean up page-display relations in the join table
		// TypeORM should handle this automatically, but we do it explicitly to be safe
		await this.dataSource
			.createQueryBuilder()
			.delete()
			.from('dashboard_module_pages_displays')
			.where('displayId = :id', { id })
			.execute();

		await this.repository.remove(display);

		this.logger.debug(`Successfully removed display with id=${id}`);

		this.eventEmitter.emit(EventType.DISPLAY_DELETED, { id });
	}

	private async findByField(field: keyof DisplayEntity, value: string): Promise<DisplayEntity | null> {
		this.logger.debug(`Fetching display by ${field}`);

		const display = await this.repository.findOne({ where: { [field]: value } });

		if (!display) {
			this.logger.warn(`Display not found by ${field}`);

			return null;
		}

		this.logger.debug(`Successfully fetched display`);

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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new DisplaysValidationException('Provided display data is invalid.');
		}

		return dtoInstance;
	}
}
