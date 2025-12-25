import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { BulkAssignDto } from '../dto/bulk-assign.dto';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { SpaceEntity } from '../entities/space.entity';
import { EventType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';

@Injectable()
export class SpacesService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesService');

	constructor(
		@InjectRepository(SpaceEntity)
		private readonly repository: Repository<SpaceEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<SpaceEntity[]> {
		this.logger.debug('Fetching all spaces');

		const spaces = await this.repository.find({
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${spaces.length} spaces`);

		return spaces;
	}

	async findOne(id: string): Promise<SpaceEntity | null> {
		this.logger.debug(`Fetching space with id=${id}`);

		const space = await this.repository.findOne({ where: { id } });

		if (!space) {
			this.logger.warn(`Space not found by id=${id}`);

			return null;
		}

		this.logger.debug('Successfully fetched space');

		return space;
	}

	async getOneOrThrow(id: string): Promise<SpaceEntity> {
		const space = await this.findOne(id);

		if (!space) {
			this.logger.error(`Space with id=${id} not found`);

			throw new SpacesNotFoundException('Requested space does not exist');
		}

		return space;
	}

	async create(createDto: CreateSpaceDto): Promise<SpaceEntity> {
		this.logger.debug('Creating new space');

		const dtoInstance = await this.validateDto(CreateSpaceDto, createDto);

		const space = this.repository.create(toInstance(SpaceEntity, dtoInstance));

		await this.repository.save(space);

		// Re-fetch to get database default values populated
		const savedSpace = await this.getOneOrThrow(space.id);

		this.logger.debug(`Successfully created space with id=${savedSpace.id}`);

		this.eventEmitter.emit(EventType.SPACE_CREATED, savedSpace);

		return savedSpace;
	}

	async update(id: string, updateDto: UpdateSpaceDto): Promise<SpaceEntity> {
		this.logger.debug(`Updating space with id=${id}`);

		const space = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto(UpdateSpaceDto, updateDto);

		Object.assign(space, omitBy(toInstance(SpaceEntity, dtoInstance), isUndefined));

		await this.repository.save(space);

		this.logger.debug(`Successfully updated space with id=${space.id}`);

		this.eventEmitter.emit(EventType.SPACE_UPDATED, space);

		return space;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing space with id=${id}`);

		const space = await this.getOneOrThrow(id);

		// Set spaceId to null for all devices in this space
		await this.deviceRepository
			.createQueryBuilder()
			.update()
			.set({ spaceId: null })
			.where('spaceId = :id', { id })
			.execute();

		// Set spaceId to null for all displays in this space
		await this.displayRepository
			.createQueryBuilder()
			.update()
			.set({ spaceId: null })
			.where('spaceId = :id', { id })
			.execute();

		await this.repository.remove(space);

		this.logger.debug(`Successfully removed space with id=${id}`);

		this.eventEmitter.emit(EventType.SPACE_DELETED, { id });
	}

	async findDevicesBySpace(spaceId: string): Promise<DeviceEntity[]> {
		this.logger.debug(`Fetching devices for space with id=${spaceId}`);

		// Verify space exists
		await this.getOneOrThrow(spaceId);

		const devices = await this.deviceRepository.find({
			where: { spaceId },
			order: { name: 'ASC' },
		});

		this.logger.debug(`Found ${devices.length} devices in space`);

		return devices;
	}

	async findDisplaysBySpace(spaceId: string): Promise<DisplayEntity[]> {
		this.logger.debug(`Fetching displays for space with id=${spaceId}`);

		// Verify space exists
		await this.getOneOrThrow(spaceId);

		const displays = await this.displayRepository.find({
			where: { spaceId },
			order: { name: 'ASC' },
		});

		this.logger.debug(`Found ${displays.length} displays in space`);

		return displays;
	}

	async bulkAssign(
		spaceId: string,
		bulkAssignDto: BulkAssignDto,
	): Promise<{ devicesAssigned: number; displaysAssigned: number }> {
		this.logger.debug(`Bulk assigning to space with id=${spaceId}`);

		// Verify space exists
		await this.getOneOrThrow(spaceId);

		const dtoInstance = await this.validateDto(BulkAssignDto, bulkAssignDto);

		let devicesAssigned = 0;
		let displaysAssigned = 0;

		// Assign devices
		if (dtoInstance.deviceIds && dtoInstance.deviceIds.length > 0) {
			const result = await this.deviceRepository
				.createQueryBuilder()
				.update()
				.set({ spaceId })
				.where('id IN (:...ids)', { ids: dtoInstance.deviceIds })
				.execute();

			devicesAssigned = result.affected || 0;
			this.logger.debug(`Assigned ${devicesAssigned} devices to space`);
		}

		// Assign displays
		if (dtoInstance.displayIds && dtoInstance.displayIds.length > 0) {
			const result = await this.displayRepository
				.createQueryBuilder()
				.update()
				.set({ spaceId })
				.where('id IN (:...ids)', { ids: dtoInstance.displayIds })
				.execute();

			displaysAssigned = result.affected || 0;
			this.logger.debug(`Assigned ${displaysAssigned} displays to space`);
		}

		this.logger.debug(`Successfully bulk assigned to space with id=${spaceId}`);

		return { devicesAssigned, displaysAssigned };
	}

	async unassignDevices(deviceIds: string[]): Promise<number> {
		this.logger.debug(`Unassigning ${deviceIds.length} devices from their spaces`);

		if (deviceIds.length === 0) {
			return 0;
		}

		const result = await this.deviceRepository
			.createQueryBuilder()
			.update()
			.set({ spaceId: null })
			.where('id IN (:...ids)', { ids: deviceIds })
			.execute();

		const unassigned = result.affected || 0;
		this.logger.debug(`Unassigned ${unassigned} devices`);

		return unassigned;
	}

	async unassignDisplays(displayIds: string[]): Promise<number> {
		this.logger.debug(`Unassigning ${displayIds.length} displays from their spaces`);

		if (displayIds.length === 0) {
			return 0;
		}

		const result = await this.displayRepository
			.createQueryBuilder()
			.update()
			.set({ spaceId: null })
			.where('id IN (:...ids)', { ids: displayIds })
			.execute();

		const unassigned = result.affected || 0;
		this.logger.debug(`Unassigned ${unassigned} displays`);

		return unassigned;
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

			throw new SpacesValidationException('Provided space data is invalid.');
		}

		return dtoInstance;
	}
}
