/* eslint-disable
@typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-return,
@typescript-eslint/no-unsafe-assignment,
@typescript-eslint/require-await,
@typescript-eslint/no-unused-vars
*/
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SpacesNotFoundException } from '../../../modules/spaces/spaces.exceptions';
import { SignageAnnouncementEntity } from '../entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from '../entities/signage-info-panel-space.entity';
import { EventType } from '../spaces-signage-info-panel.constants';
import {
	SpacesSignageInfoPanelNotFoundException,
	SpacesSignageInfoPanelValidationException,
} from '../spaces-signage-info-panel.exceptions';

import { SignageAnnouncementsService } from './signage-announcements.service';

describe('SignageAnnouncementsService', () => {
	let service: SignageAnnouncementsService;
	let repository: Repository<SignageAnnouncementEntity>;
	let spacesService: SpacesService;
	let spacesTypeMapper: SpacesTypeMapperService;
	let dataSource: DataSource;
	let eventEmitter: EventEmitter2;

	const spaceId = uuid();

	const makeSignageSpace = (): Partial<SignageInfoPanelSpaceEntity> => ({
		id: spaceId,
		name: 'Lobby',
	});

	const makeRoomSpace = (): Partial<SignageInfoPanelSpaceEntity> => ({
		id: spaceId,
		name: 'Kitchen',
	});

	const makeAnnouncement = (overrides: Partial<SignageAnnouncementEntity> = {}): SignageAnnouncementEntity =>
		({
			id: overrides.id ?? uuid(),
			spaceId,
			order: overrides.order ?? 0,
			title: overrides.title ?? 'Welcome',
			body: overrides.body ?? null,
			icon: overrides.icon ?? null,
			activeFrom: overrides.activeFrom ?? null,
			activeUntil: overrides.activeUntil ?? null,
			priority: overrides.priority ?? 0,
			createdAt: new Date(),
			updatedAt: null,
			...overrides,
		}) as SignageAnnouncementEntity;

	const subtypeRepoFindOne = jest.fn();
	const queryBuilderGetRawOne = jest.fn();
	let transactionManagerUpdate: jest.Mock;

	beforeEach(async () => {
		jest.clearAllMocks();

		subtypeRepoFindOne.mockReset();
		queryBuilderGetRawOne.mockReset();

		const subtypeRepo = { findOne: subtypeRepoFindOne };

		transactionManagerUpdate = jest.fn();
		const transactionManager = { update: transactionManagerUpdate };

		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((input) => input),
			save: jest.fn(async (input) => input),
			remove: jest.fn(async () => {}),
			createQueryBuilder: jest.fn(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getRawOne: queryBuilderGetRawOne,
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SignageAnnouncementsService,
				{ provide: getRepositoryToken(SignageAnnouncementEntity), useFactory: mockRepository },
				{
					provide: SpacesService,
					useValue: {
						getOneOrThrow: jest.fn(),
					},
				},
				{
					provide: SpacesTypeMapperService,
					useValue: {
						getMapping: jest.fn(() => ({
							type: SpaceType.SIGNAGE_INFO_PANEL,
							class: SignageInfoPanelSpaceEntity,
							createDto: class {},
							updateDto: class {},
						})),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => subtypeRepo),
						transaction: jest.fn(async (cb: (manager: unknown) => Promise<void>) => cb(transactionManager)),
					},
				},
				{
					provide: EventEmitter2,
					useValue: { emit: jest.fn() },
				},
			],
		}).compile();

		service = module.get(SignageAnnouncementsService);
		repository = module.get(getRepositoryToken(SignageAnnouncementEntity));
		spacesService = module.get(SpacesService);
		spacesTypeMapper = module.get(SpacesTypeMapperService);
		dataSource = module.get(DataSource);
		eventEmitter = module.get(EventEmitter2);
	});

	describe('findAll', () => {
		it('returns announcements sorted by priority / order when the space is a signage space', async () => {
			(spacesService.getOneOrThrow as jest.Mock).mockResolvedValue({
				...makeSignageSpace(),
				type: SpaceType.SIGNAGE_INFO_PANEL,
			});
			subtypeRepoFindOne.mockResolvedValue(makeSignageSpace());
			const rows = [makeAnnouncement({ order: 0 }), makeAnnouncement({ order: 1 })];
			(repository.find as jest.Mock).mockResolvedValue(rows);

			const result = await service.findAll(spaceId);

			expect(result).toBe(rows);
			expect(repository.find).toHaveBeenCalledWith({
				where: { spaceId },
				order: { priority: 'DESC', order: 'ASC', createdAt: 'ASC' },
			});
		});

		it('rejects non-signage spaces with a validation exception', async () => {
			(spacesService.getOneOrThrow as jest.Mock).mockResolvedValue({
				...makeRoomSpace(),
				type: SpaceType.ROOM,
			});

			await expect(service.findAll(spaceId)).rejects.toBeInstanceOf(SpacesSignageInfoPanelValidationException);
		});

		it('propagates SpacesNotFoundException when the space does not exist', async () => {
			(spacesService.getOneOrThrow as jest.Mock).mockRejectedValue(new SpacesNotFoundException('missing'));

			await expect(service.findAll(spaceId)).rejects.toBeInstanceOf(SpacesNotFoundException);
		});
	});

	describe('create', () => {
		beforeEach(() => {
			(spacesService.getOneOrThrow as jest.Mock).mockResolvedValue({
				...makeSignageSpace(),
				type: SpaceType.SIGNAGE_INFO_PANEL,
			});
			subtypeRepoFindOne.mockResolvedValue(makeSignageSpace());
		});

		it('assigns the next available order when omitted', async () => {
			queryBuilderGetRawOne.mockResolvedValue({ max: 2 });
			(repository.save as jest.Mock).mockImplementation(async (entity) => ({
				...entity,
				id: entity.id ?? uuid(),
			}));

			const created = await service.create(spaceId, {
				title: 'Pool closed',
				priority: 5,
			});

			expect(created.order).toBe(3);
			expect(created.priority).toBe(5);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.ANNOUNCEMENT_CREATED,
				expect.objectContaining({ title: 'Pool closed' }),
			);
		});

		it('rejects when active_from is after active_until', async () => {
			await expect(
				service.create(spaceId, {
					title: 'Invalid window',
					active_from: new Date('2025-02-01T10:00:00Z'),
					active_until: new Date('2025-02-01T08:00:00Z'),
				}),
			).rejects.toBeInstanceOf(SpacesSignageInfoPanelValidationException);
		});
	});

	describe('update', () => {
		beforeEach(() => {
			(spacesService.getOneOrThrow as jest.Mock).mockResolvedValue({
				...makeSignageSpace(),
				type: SpaceType.SIGNAGE_INFO_PANEL,
			});
			subtypeRepoFindOne.mockResolvedValue(makeSignageSpace());
		});

		it('updates fields, saves and emits an update event', async () => {
			const existing = makeAnnouncement({ title: 'Old', priority: 0 });
			(repository.findOne as jest.Mock).mockResolvedValue(existing);
			(repository.save as jest.Mock).mockImplementation(async (entity) => entity);

			const updated = await service.update(existing.id, spaceId, {
				title: 'New title',
				priority: 10,
			});

			expect(updated.title).toBe('New title');
			expect(updated.priority).toBe(10);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.ANNOUNCEMENT_UPDATED, expect.any(Object));
		});

		it('throws when the announcement cannot be found', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			await expect(service.update(uuid(), spaceId, { title: 'x' })).rejects.toBeInstanceOf(
				SpacesSignageInfoPanelNotFoundException,
			);
		});
	});

	describe('remove', () => {
		it('deletes the announcement and emits a delete event', async () => {
			const existing = makeAnnouncement();
			(repository.findOne as jest.Mock).mockResolvedValue(existing);

			await service.remove(existing.id, spaceId);

			expect(repository.remove).toHaveBeenCalledWith(existing);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.ANNOUNCEMENT_DELETED,
				expect.objectContaining({ id: existing.id }),
			);
		});
	});

	describe('reorder', () => {
		beforeEach(() => {
			(spacesService.getOneOrThrow as jest.Mock).mockResolvedValue({
				...makeSignageSpace(),
				type: SpaceType.SIGNAGE_INFO_PANEL,
			});
			subtypeRepoFindOne.mockResolvedValue(makeSignageSpace());
		});

		it('rejects duplicate ids in the reorder payload', async () => {
			const id = uuid();
			await expect(
				service.reorder(spaceId, {
					items: [
						{ id, order: 0 },
						{ id, order: 1 },
					],
				}),
			).rejects.toBeInstanceOf(SpacesSignageInfoPanelValidationException);
		});

		it('rejects when some announcement ids are missing', async () => {
			(repository.find as jest.Mock)
				.mockResolvedValueOnce([makeAnnouncement({ id: 'known' })])
				.mockResolvedValueOnce([]);

			await expect(
				service.reorder(spaceId, {
					items: [
						{ id: 'known', order: 0 },
						{ id: 'missing', order: 1 },
					],
				}),
			).rejects.toBeInstanceOf(SpacesSignageInfoPanelNotFoundException);
		});

		it('updates order in a transaction and returns the refreshed rows', async () => {
			const a = makeAnnouncement({ id: 'a' });
			const b = makeAnnouncement({ id: 'b' });
			(repository.find as jest.Mock).mockResolvedValueOnce([a, b]).mockResolvedValueOnce([
				{ ...b, order: 0 },
				{ ...a, order: 1 },
			]);

			const result = await service.reorder(spaceId, {
				items: [
					{ id: 'b', order: 0 },
					{ id: 'a', order: 1 },
				],
			});

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(transactionManagerUpdate).toHaveBeenCalledTimes(2);
			expect(result.map((r) => r.id)).toEqual(['b', 'a']);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.ANNOUNCEMENT_UPDATED, expect.any(Object));
		});
	});
});
