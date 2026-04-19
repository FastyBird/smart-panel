import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, In, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { CreateSignageInfoPanelSpaceDto } from '../dto/create-signage-info-panel-space.dto';
import { ReorderAnnouncementsDto } from '../dto/reorder-announcements.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import { UpdateSignageInfoPanelSpaceDto } from '../dto/update-signage-info-panel-space.dto';
import { SignageAnnouncementEntity } from '../entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from '../entities/signage-info-panel-space.entity';
import { EventType, SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME } from '../spaces-signage-info-panel.constants';
import {
	SpacesSignageInfoPanelNotFoundException,
	SpacesSignageInfoPanelValidationException,
} from '../spaces-signage-info-panel.exceptions';

@Injectable()
export class SignageAnnouncementsService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
		'SignageAnnouncementsService',
	);

	constructor(
		@InjectRepository(SignageAnnouncementEntity)
		private readonly repository: Repository<SignageAnnouncementEntity>,
		private readonly spacesService: SpacesService,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(spaceId: string): Promise<SignageAnnouncementEntity[]> {
		await this.getSignageSpaceOrThrow(spaceId);

		this.logger.debug(`Fetching announcements for spaceId=${spaceId}`);

		const announcements = await this.repository.find({
			where: { spaceId },
			order: { priority: 'DESC', order: 'ASC', createdAt: 'ASC' },
		});

		this.logger.debug(`Found ${announcements.length} announcements for spaceId=${spaceId}`);

		return announcements;
	}

	async findOne(id: string, spaceId: string): Promise<SignageAnnouncementEntity | null> {
		return this.repository.findOne({ where: { id, spaceId } });
	}

	async getOneOrThrow(id: string, spaceId: string): Promise<SignageAnnouncementEntity> {
		const announcement = await this.findOne(id, spaceId);

		if (!announcement) {
			this.logger.error(`Announcement id=${id} not found for spaceId=${spaceId}`);

			throw new SpacesSignageInfoPanelNotFoundException('Requested announcement does not exist');
		}

		return announcement;
	}

	async create(spaceId: string, createDto: CreateAnnouncementDto): Promise<SignageAnnouncementEntity> {
		this.logger.debug(`Creating announcement for spaceId=${spaceId}`);

		const space = await this.getSignageSpaceOrThrow(spaceId);

		this.ensureActiveWindow(createDto.active_from ?? null, createDto.active_until ?? null);

		const dtoInstance = await this.validateDto(CreateAnnouncementDto, createDto);

		const order = dtoInstance.order ?? (await this.nextOrderFor(space.id));

		const announcement = this.repository.create(
			toInstance(SignageAnnouncementEntity, {
				...dtoInstance,
				spaceId: space.id,
				order,
				priority: dtoInstance.priority ?? 0,
			}),
		);

		const saved = await this.repository.save(announcement);

		this.logger.debug(`Created announcement id=${saved.id} for spaceId=${space.id}`);

		this.eventEmitter.emit(EventType.ANNOUNCEMENT_CREATED, saved);

		return saved;
	}

	async update(id: string, spaceId: string, updateDto: UpdateAnnouncementDto): Promise<SignageAnnouncementEntity> {
		this.logger.debug(`Updating announcement id=${id} for spaceId=${spaceId}`);

		const announcement = await this.getOneOrThrow(id, spaceId);

		const dtoInstance = await this.validateDto(UpdateAnnouncementDto, updateDto);

		const nextActiveFrom = dtoInstance.active_from === undefined ? announcement.activeFrom : dtoInstance.active_from;
		const nextActiveUntil =
			dtoInstance.active_until === undefined ? announcement.activeUntil : dtoInstance.active_until;

		this.ensureActiveWindow(nextActiveFrom ?? null, nextActiveUntil ?? null);

		const updateFields = omitBy(toInstance(SignageAnnouncementEntity, dtoInstance), isUndefined);

		Object.assign(announcement, updateFields);

		const saved = await this.repository.save(announcement);

		this.logger.debug(`Updated announcement id=${saved.id}`);

		this.eventEmitter.emit(EventType.ANNOUNCEMENT_UPDATED, saved);

		return saved;
	}

	async remove(id: string, spaceId: string): Promise<void> {
		const announcement = await this.getOneOrThrow(id, spaceId);

		const snapshot = { ...announcement };

		await this.repository.remove(announcement);

		this.logger.log(`Removed announcement id=${snapshot.id} for spaceId=${spaceId}`);

		this.eventEmitter.emit(EventType.ANNOUNCEMENT_DELETED, snapshot);
	}

	async reorder(spaceId: string, reorderDto: ReorderAnnouncementsDto): Promise<SignageAnnouncementEntity[]> {
		this.logger.debug(`Reordering ${reorderDto.items.length} announcements for spaceId=${spaceId}`);

		await this.getSignageSpaceOrThrow(spaceId);

		const ids = reorderDto.items.map((entry) => entry.id);
		if (new Set(ids).size !== ids.length) {
			throw new SpacesSignageInfoPanelValidationException('Reorder payload contains duplicate announcement ids.');
		}

		const existing = await this.repository.find({ where: { id: In(ids), spaceId } });

		if (existing.length !== ids.length) {
			const existingIds = new Set(existing.map((e) => e.id));
			const missing = ids.filter((id) => !existingIds.has(id));
			throw new SpacesSignageInfoPanelNotFoundException(
				`Cannot reorder: announcements not found for this space: ${missing.join(', ')}`,
			);
		}

		await this.dataSource.transaction(async (manager) => {
			for (const entry of reorderDto.items) {
				await manager.update(SignageAnnouncementEntity, { id: entry.id, spaceId }, { order: entry.order });
			}
		});

		const updated = await this.repository.find({
			where: { spaceId },
			order: { priority: 'DESC', order: 'ASC', createdAt: 'ASC' },
		});

		for (const item of updated) {
			this.eventEmitter.emit(EventType.ANNOUNCEMENT_UPDATED, item);
		}

		return updated;
	}

	private async nextOrderFor(spaceId: string): Promise<number> {
		const max = await this.repository
			.createQueryBuilder('announcement')
			.select('MAX(announcement.order)', 'max')
			.where('announcement.spaceId = :spaceId', { spaceId })
			.getRawOne<{ max: number | null }>();

		return (max?.max ?? -1) + 1;
	}

	private ensureActiveWindow(from: Date | null, until: Date | null): void {
		if (from && until && from.getTime() > until.getTime()) {
			throw new SpacesSignageInfoPanelValidationException(
				'Announcement active_from must be earlier than or equal to active_until.',
			);
		}
	}

	private async getSignageSpaceOrThrow(spaceId: string): Promise<SignageInfoPanelSpaceEntity> {
		const space = await this.spacesService.getOneOrThrow(spaceId);

		if (space.type !== SpaceType.SIGNAGE_INFO_PANEL) {
			throw new SpacesSignageInfoPanelValidationException(
				`Space with id=${spaceId} is not a signage info-panel space.`,
			);
		}

		// Re-fetch via the subtype repository so subtype-only columns (layout, showClock, ...)
		// are populated on the returned entity.
		const mapping = this.spacesTypeMapper.getMapping<
			SignageInfoPanelSpaceEntity,
			CreateSignageInfoPanelSpaceDto,
			UpdateSignageInfoPanelSpaceDto
		>(SpaceType.SIGNAGE_INFO_PANEL);
		const subtypeRepo = this.dataSource.getRepository(mapping.class);
		const fresh = await subtypeRepo.findOne({ where: { id: space.id } });

		if (!fresh) {
			// Should be unreachable since getOneOrThrow succeeded, but defend against
			// a race where the space was deleted between the two queries.
			throw new SpacesSignageInfoPanelNotFoundException('Requested signage info-panel space does not exist.');
		}

		return fresh;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: unknown): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, { excludeExtraneousValues: false });

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Announcement DTO validation failed: ${JSON.stringify(errors)}`);

			throw new SpacesSignageInfoPanelValidationException('Provided announcement data are invalid.');
		}

		return dtoInstance;
	}
}
