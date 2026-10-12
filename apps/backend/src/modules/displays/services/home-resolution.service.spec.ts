import { Repository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import { ConnectionState, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

import { HomeResolutionService } from './home-resolution.service';
import { SpaceHomePageResolverRegistryService } from './space-home-page-resolver-registry.service';

describe('HomeResolutionService', () => {
	let service: HomeResolutionService;
	let pagesRepository: Repository<PageEntity>;
	let spacesRepository: Repository<SpaceEntity>;
	let resolverRegistry: SpaceHomePageResolverRegistryService;

	const displayId = uuid();
	const pageId1 = uuid();
	const pageId2 = uuid();

	const createMockDisplay = (overrides: Partial<DisplayEntity> = {}): DisplayEntity =>
		({
			id: displayId,
			macAddress: 'AA:BB:CC:DD:EE:FF',
			name: 'Test Display',
			version: '1.0.0',
			build: '42',
			screenWidth: 1920,
			screenHeight: 1080,
			pixelRatio: 1.5,
			unitSize: 8,
			rows: 12,
			cols: 24,
			darkMode: false,
			brightness: 100,
			screenLockDuration: 30,
			screenSaver: true,
			screenPowerOff: false,
			audioOutputSupported: false,
			audioInputSupported: false,
			speaker: false,
			speakerVolume: 50,
			microphone: false,
			microphoneVolume: 50,
			registeredFromIp: null,
			currentIpAddress: null,
			online: false,
			spaceId: null,
			space: null,
			homeMode: HomeMode.AUTO_SPACE,
			homePageId: null,
			homePage: null,
			status: ConnectionState.UNKNOWN,
			createdAt: new Date(),
			updatedAt: null,
			...overrides,
		}) as DisplayEntity;

	const createMockPage = (id: string, order: number, displays: DisplayEntity[] = []): PageEntity =>
		({
			id,
			title: `Page ${order}`,
			icon: null,
			order,
			showTopBar: true,
			dataSource: [],
			displays,
			type: 'tiles',
			createdAt: new Date(),
			updatedAt: null,
		}) as unknown as PageEntity;

	const createMockSpace = (id: string, type: SpaceType): SpaceEntity =>
		({
			id,
			type,
			name: `Space ${id}`,
		}) as unknown as SpaceEntity;

	beforeEach(async () => {
		const mockPagesQueryBuilder: Partial<SelectQueryBuilder<PageEntity>> = {
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};

		const mockPagesRepository = {
			createQueryBuilder: jest.fn().mockReturnValue(mockPagesQueryBuilder),
		};

		const mockSpacesQueryBuilder: Partial<SelectQueryBuilder<SpaceEntity>> = {
			whereInIds: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};

		const mockSpacesRepository = {
			createQueryBuilder: jest.fn().mockReturnValue(mockSpacesQueryBuilder),
			findOne: jest.fn().mockResolvedValue(null),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeResolutionService,
				SpaceHomePageResolverRegistryService,
				{ provide: getRepositoryToken(PageEntity), useValue: mockPagesRepository },
				{ provide: getRepositoryToken(SpaceEntity), useValue: mockSpacesRepository },
			],
		}).compile();

		service = module.get<HomeResolutionService>(HomeResolutionService);
		pagesRepository = module.get<Repository<PageEntity>>(getRepositoryToken(PageEntity));
		spacesRepository = module.get<Repository<SpaceEntity>>(getRepositoryToken(SpaceEntity));
		resolverRegistry = module.get<SpaceHomePageResolverRegistryService>(SpaceHomePageResolverRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('resolveHomePage', () => {
		describe('when no pages are visible', () => {
			it('should return null with fallback mode', async () => {
				const display = createMockDisplay();

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue([]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBeNull();
				expect(result.resolutionMode).toBe('fallback');
				expect(result.reason).toContain('No pages');
			});
		});

		describe('when homeMode is explicit', () => {
			it('should return explicit home page if it exists and is visible', async () => {
				const display = createMockDisplay({
					homeMode: HomeMode.EXPLICIT,
					homePageId: pageId1,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('explicit');
				expect(result.reason).toContain('explicitly configured');
			});

			it('should fallback to first page if explicit home page is not visible', async () => {
				const display = createMockDisplay({
					homeMode: HomeMode.EXPLICIT,
					homePageId: 'non-existent-page-id',
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});

		describe('fallback behavior', () => {
			it('should fallback to first page when no explicit home page is set', async () => {
				const display = createMockDisplay();

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});

			it('should fallback to first page for unassigned display (no spaceId)', async () => {
				const display = createMockDisplay({ spaceId: null });

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});

		describe('auto_space mode', () => {
			it('should use resolver-provided page when the resolver returns a visible page id', async () => {
				const spaceId = uuid();
				const space = createMockSpace(spaceId, SpaceType.ROOM);
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
					spaceId,
					space,
				});

				resolverRegistry.register(SpaceType.ROOM, { resolve: () => pageId2 });

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId2);
				expect(result.resolutionMode).toBe('auto_space');
			});

			it('should fall back when the resolver returns null', async () => {
				const spaceId = uuid();
				const space = createMockSpace(spaceId, SpaceType.ROOM);
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
					spaceId,
					space,
				});

				resolverRegistry.register(SpaceType.ROOM, { resolve: () => null });

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});

			it('should fall back when no resolver is registered for the space type', async () => {
				const spaceId = uuid();
				const space = createMockSpace(spaceId, 'signage_info_panel' as SpaceType);
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
					spaceId,
					space,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});

			it('should load the space via repository when display.space is not hydrated', async () => {
				const spaceId = uuid();
				const space = createMockSpace(spaceId, SpaceType.ROOM);
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
					spaceId,
					space: null,
				});

				jest.spyOn(spacesRepository, 'findOne').mockResolvedValue(space);
				resolverRegistry.register(SpaceType.ROOM, { resolve: () => pageId2 });

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId2);
				expect(result.resolutionMode).toBe('auto_space');
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spacesRepository.findOne).toHaveBeenCalledWith({ where: { id: spaceId } });
			});
		});

		describe('explicit home overrides auto_space', () => {
			it('should use explicit home page even when a resolver is registered', async () => {
				const spaceId = uuid();
				const space = createMockSpace(spaceId, SpaceType.ROOM);
				const display = createMockDisplay({
					homeMode: HomeMode.EXPLICIT,
					homePageId: pageId1,
					spaceId,
					space,
				});

				resolverRegistry.register(SpaceType.ROOM, { resolve: () => pageId2 });

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('explicit');
			});
		});

		describe('page visibility', () => {
			it('should only consider pages visible to the display', async () => {
				const display = createMockDisplay({ id: displayId });

				const displayEntity = { id: displayId } as DisplayEntity;
				const otherDisplayEntity = { id: uuid() } as DisplayEntity;

				// Page 1 is assigned only to another display
				const page1 = createMockPage(pageId1, 0, [otherDisplayEntity]);
				// Page 2 is assigned to this display
				const page2 = createMockPage(pageId2, 1, [displayEntity]);

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue([page1, page2]);

				const result = await service.resolveHomePage(display);

				// Should return page2 since page1 is not visible to this display
				expect(result.pageId).toBe(pageId2);
			});

			it('should include pages with empty displays array (visible to all)', async () => {
				const display = createMockDisplay();

				const page1 = createMockPage(pageId1, 0, []); // Visible to all
				const page2 = createMockPage(pageId2, 1, []); // Visible to all

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue([page1, page2]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
			});
		});
	});

	describe('resolveHomePagesBatch', () => {
		const displayId2 = uuid();

		it('should return empty map for empty displays array', async () => {
			const result = await service.resolveHomePagesBatch([]);

			expect(result.size).toBe(0);
		});

		it('should resolve home pages for multiple displays in batch', async () => {
			const display1 = createMockDisplay({ id: displayId });
			const display2 = createMockDisplay({ id: displayId2 });

			const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			const result = await service.resolveHomePagesBatch([display1, display2]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(pageId1);
			expect(result.get(displayId)?.resolutionMode).toBe('fallback');
			expect(result.get(displayId2)?.pageId).toBe(pageId1);
			expect(result.get(displayId2)?.resolutionMode).toBe('fallback');
		});

		it('should dispatch to the per-space-type resolver in batch', async () => {
			const roomSpaceId = uuid();
			const entrySpaceId = uuid();
			const roomSpace = createMockSpace(roomSpaceId, SpaceType.ROOM);
			const entrySpace = createMockSpace(entrySpaceId, SpaceType.ENTRY);

			const roomDisplay = createMockDisplay({ id: displayId, spaceId: roomSpaceId });
			const entryDisplay = createMockDisplay({ id: displayId2, spaceId: entrySpaceId });

			resolverRegistry.register(SpaceType.ROOM, { resolve: () => pageId2 });
			resolverRegistry.register(SpaceType.ENTRY, { resolve: () => null });

			const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			const mockSpacesQb = spacesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<SpaceEntity>>;
			mockSpacesQb.getMany.mockResolvedValue([roomSpace, entrySpace]);

			const result = await service.resolveHomePagesBatch([roomDisplay, entryDisplay]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(pageId2);
			expect(result.get(displayId)?.resolutionMode).toBe('auto_space');
			expect(result.get(displayId2)?.pageId).toBe(pageId1);
			expect(result.get(displayId2)?.resolutionMode).toBe('fallback');
		});

		it('should handle explicit home mode in batch', async () => {
			const explicitDisplay = createMockDisplay({
				id: displayId,
				homeMode: HomeMode.EXPLICIT,
				homePageId: pageId1,
			});

			const roomDisplay = createMockDisplay({ id: displayId2 });

			const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			const result = await service.resolveHomePagesBatch([explicitDisplay, roomDisplay]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(pageId1);
			expect(result.get(displayId)?.resolutionMode).toBe('explicit');
			expect(result.get(displayId2)?.pageId).toBe(pageId1);
			expect(result.get(displayId2)?.resolutionMode).toBe('fallback');
		});

		it('should respect page visibility in batch operations', async () => {
			const displayEntity1 = { id: displayId } as DisplayEntity;
			const displayEntity2 = { id: displayId2 } as DisplayEntity;

			const display1 = createMockDisplay({ id: displayId });
			const display2 = createMockDisplay({ id: displayId2 });

			// Page 1 visible only to display1, page 2 visible only to display2
			const page1 = createMockPage(pageId1, 0, [displayEntity1]);
			const page2 = createMockPage(pageId2, 1, [displayEntity2]);

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue([page1, page2]);

			const result = await service.resolveHomePagesBatch([display1, display2]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(pageId1);
			expect(result.get(displayId2)?.pageId).toBe(pageId2);
		});
	});
});
