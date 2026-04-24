import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { DISPLAYS_MODULE_NAME, EventType, HomeMode } from '../displays.constants';
import { DisplaysNotFoundException, DisplaysValidationException } from '../displays.exceptions';
import { UpdateDisplayDto } from '../dto/update-display.dto';
import { DisplayEntity } from '../entities/displays.entity';

import { SpaceSelectionValidatorRegistryService } from './space-selection-validator-registry.service';

@Injectable()
export class DisplaysService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplaysService');

	constructor(
		@InjectRepository(DisplayEntity)
		private readonly repository: Repository<DisplayEntity>,
		@InjectRepository(SpaceEntity)
		private readonly spaceRepository: Repository<SpaceEntity>,
		@InjectRepository(PageEntity)
		private readonly pageRepository: Repository<PageEntity>,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
		private readonly spaceSelectionValidatorRegistry: SpaceSelectionValidatorRegistryService,
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

	async updateCurrentIpAddress(id: string, ipAddress: string): Promise<void> {
		await this.repository.update(id, { currentIpAddress: ipAddress });

		this.logger.debug(`Updated current IP address for display=${id}`);
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

		// Determine the effective spaceId and home mode/page after the update
		const effectiveSpaceId = dtoInstance.space_id !== undefined ? dtoInstance.space_id : display.spaceId;
		const effectiveHomeMode = dtoInstance.home_mode ?? display.homeMode;
		const effectiveHomePageId = dtoInstance.home_page_id !== undefined ? dtoInstance.home_page_id : display.homePageId;

		// Validate space selection (existence + plugin-contributed rules)
		await this.validateSpaceSelection(effectiveSpaceId, display.id);

		// Validate homeMode/homePageId combination
		await this.validateHomeModePageCombination(effectiveHomeMode, effectiveHomePageId);

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(DisplayEntity, dtoInstance), isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged =
			Object.keys(updateFields).some((key) => {
				const newValue = (updateFields as Record<string, unknown>)[key];
				const existingValue = (display as unknown as Record<string, unknown>)[key];

				// Deep comparison for arrays
				if (Array.isArray(newValue) && Array.isArray(existingValue)) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}

				// Deep comparison for plain objects
				if (
					typeof newValue === 'object' &&
					typeof existingValue === 'object' &&
					newValue !== null &&
					existingValue !== null
				) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}

				// Handle null/undefined comparison
				if (newValue === null && existingValue === null) {
					return false;
				}
				if (newValue === null || existingValue === null) {
					return true;
				}

				// Simple value comparison
				return newValue !== existingValue;
			}) ||
			(dtoInstance.space_id !== undefined && display.spaceId !== (dtoInstance.space_id ?? null)) ||
			(dtoInstance.home_page_id !== undefined && display.homePageId !== (dtoInstance.home_page_id ?? null));

		Object.assign(display, updateFields);

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

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.DISPLAY_UPDATED, display);
		}

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

	/**
	 * Validates that the target space exists and passes every plugin-registered
	 * validator. A `null` spaceId is always valid (unassigned display).
	 */
	private async validateSpaceSelection(spaceId: string | null | undefined, displayId: string | null): Promise<void> {
		if (!spaceId) {
			return;
		}

		const space = await this.spaceRepository.findOne({ where: { id: spaceId } });

		if (!space) {
			throw new DisplaysValidationException('The specified space does not exist.');
		}

		for (const validator of this.spaceSelectionValidatorRegistry.getValidators()) {
			await validator.validate(space, displayId);
		}
	}

	/**
	 * Validates the homeMode/homePageId combination:
	 * - homeMode=explicit requires homePageId
	 * - homeMode!=explicit must not have homePageId (or it should be null)
	 */
	private async validateHomeModePageCombination(
		homeMode: HomeMode,
		homePageId: string | null | undefined,
	): Promise<void> {
		if (homeMode === HomeMode.EXPLICIT) {
			// Explicit mode requires a home page
			if (!homePageId) {
				throw new DisplaysValidationException(
					'Home mode "explicit" requires a home page selection. Please select a page.',
				);
			}

			// Validate the page exists
			const page = await this.pageRepository.findOne({ where: { id: homePageId } });

			if (!page) {
				throw new DisplaysValidationException('The specified home page does not exist.');
			}
		} else {
			// Non-explicit modes should not have a homePageId
			if (homePageId) {
				throw new DisplaysValidationException(
					`Home mode "${homeMode}" does not use an explicit page selection. The home page will be determined automatically.`,
				);
			}
		}
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
