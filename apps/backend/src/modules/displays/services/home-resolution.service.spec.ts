import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { ConnectionState, DisplayRole, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

import { HomeResolutionService } from './home-resolution.service';

describe('HomeResolutionService', () => {
	let service: HomeResolutionService;
	let pagesRepository: Repository<PageEntity>;
	let dataSource: DataSource;

	const displayId = uuid();
	const pageId1 = uuid();
	const pageId2 = uuid();
	const spacePageId = uuid();
	const spaceId = uuid();

	const createMockDisplay = (overrides: Partial<DisplayEntity> = {}): DisplayEntity =>
		({
			id: displayId,
			macAddress: 'AA:BB:CC:DD:EE:FF',
			name: 'Test Display',
			role: DisplayRole.ROOM,
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

	beforeEach(async () => {
		const mockQueryBuilder: Partial<SelectQueryBuilder<PageEntity>> = {
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		};

		const mockPagesRepository = {
			createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
		};

		const mockDataSource = {
			query: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeResolutionService,
				{ provide: getRepositoryToken(PageEntity), useValue: mockPagesRepository },
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get<HomeResolutionService>(HomeResolutionService);
		pagesRepository = module.get<Repository<PageEntity>>(getRepositoryToken(PageEntity));
		dataSource = module.get<DataSource>(DataSource);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
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

		describe('when role is room (v2 spec)', () => {
			it('should return space page if display has spaceId and SpacePage exists', async () => {
				const display = createMockDisplay({
					role: DisplayRole.ROOM,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Mock the space page query
				jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: spacePageId }]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(spacePageId);
				expect(result.resolutionMode).toBe('auto_role');
				expect(result.reason).toContain('room role');
			});

			it('should fallback to first page if no SpacePage exists for space', async () => {
				const display = createMockDisplay({
					role: DisplayRole.ROOM,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Mock the space page query - no results
				jest.spyOn(dataSource, 'query').mockResolvedValue([]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});

			it('should fallback to first page if display has no spaceId', async () => {
				const display = createMockDisplay({
					role: DisplayRole.ROOM,
					spaceId: null,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});

		describe('when role is master (v2 spec)', () => {
			const houseOverviewPageId = uuid();

			it('should return House Overview page if one exists', async () => {
				const display = createMockDisplay({
					role: DisplayRole.MASTER,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(houseOverviewPageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Mock the house overview page query
				jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: houseOverviewPageId }]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(houseOverviewPageId);
				expect(result.resolutionMode).toBe('auto_role');
				expect(result.reason).toContain('master role');
			});

			it('should fallback to first page if no House Overview page exists', async () => {
				const display = createMockDisplay({
					role: DisplayRole.MASTER,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Mock the house overview page query - no results
				jest.spyOn(dataSource, 'query').mockResolvedValue([]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});

		describe('when role is entry (v2 spec)', () => {
			it('should fallback to first page as house modes page type not yet implemented', async () => {
				const display = createMockDisplay({
					role: DisplayRole.ENTRY,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});

		describe('explicit home overrides role (v2 spec)', () => {
			it('should use explicit home page even for master role', async () => {
				const display = createMockDisplay({
					role: DisplayRole.MASTER,
					homeMode: HomeMode.EXPLICIT,
					homePageId: pageId1,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('explicit');
			});
		});

		describe('when homeMode is first_page', () => {
			it('should return first page by order', async () => {
				const display = createMockDisplay({
					homeMode: HomeMode.FIRST_PAGE,
				});

				const pages = [createMockPage(pageId2, 1), createMockPage(pageId1, 0)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				// Simulate sorted result (by order)
				mockQueryBuilder.getMany.mockResolvedValue([pages[1], pages[0]]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('first_page');
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

		describe('legacy auto_space mode (backward compatibility)', () => {
			it('should use auto_space mode for master role display with spaceId', async () => {
				const display = createMockDisplay({
					role: DisplayRole.MASTER,
					homeMode: HomeMode.AUTO_SPACE,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// First query for house overview (master role) returns nothing
				// Second query for space page returns the space page
				jest
					.spyOn(dataSource, 'query')
					.mockResolvedValueOnce([]) // No house overview page
					.mockResolvedValueOnce([{ id: spacePageId }]); // Space page exists

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(spacePageId);
				expect(result.resolutionMode).toBe('auto_space');
				expect(result.reason).toContain('SpacePage');
			});

			it('should use auto_space mode for entry role display with spaceId when no house modes page exists', async () => {
				const display = createMockDisplay({
					role: DisplayRole.ENTRY,
					homeMode: HomeMode.AUTO_SPACE,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Entry role first tries to find house modes page (returns empty), then falls through to auto_space
				jest
					.spyOn(dataSource, 'query')
					.mockResolvedValueOnce([]) // No house modes page
					.mockResolvedValueOnce([{ id: spacePageId }]); // Space page exists

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(spacePageId);
				expect(result.resolutionMode).toBe('auto_space');
			});

			it('should not use auto_space mode for room role (handled by role resolution)', async () => {
				// Room role with auto_space should use auto_role, not auto_space
				const display = createMockDisplay({
					role: DisplayRole.ROOM,
					homeMode: HomeMode.AUTO_SPACE,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Query for space page returns the space page
				jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: spacePageId }]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(spacePageId);
				// Should be auto_role (room role), not auto_space
				expect(result.resolutionMode).toBe('auto_role');
			});
		});

		describe('default values (backward compatibility)', () => {
			it('should work with default role (ROOM) and default homeMode (AUTO_SPACE)', async () => {
				// Display with default values should resolve correctly
				const display = createMockDisplay({
					// Using defaults from entity: role = ROOM, homeMode = AUTO_SPACE
					spaceId: spaceId,
				});

				expect(display.role).toBe(DisplayRole.ROOM);
				expect(display.homeMode).toBe(HomeMode.AUTO_SPACE);

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: spacePageId }]);

				const result = await service.resolveHomePage(display);

				// Should use room role resolution (auto_role)
				expect(result.pageId).toBe(spacePageId);
				expect(result.resolutionMode).toBe('auto_role');
			});

			it('should fallback gracefully for display with no spaceId (legacy scenario)', async () => {
				const display = createMockDisplay({
					// Default role and homeMode, no spaceId
					spaceId: null,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				const result = await service.resolveHomePage(display);

				// Should fallback to first page
				expect(result.pageId).toBe(pageId1);
				expect(result.resolutionMode).toBe('fallback');
			});
		});
	});

	describe('resolveHomePagesBatch', () => {
		const displayId2 = uuid();
		const spaceId2 = uuid();
		const spacePageId2 = uuid();
		const houseOverviewPageId = uuid();

		it('should return empty map for empty displays array', async () => {
			const result = await service.resolveHomePagesBatch([]);

			expect(result.size).toBe(0);
		});

		it('should resolve home pages for multiple displays in batch', async () => {
			const display1 = createMockDisplay({
				id: displayId,
				role: DisplayRole.ROOM,
				spaceId: spaceId,
			});

			const display2 = createMockDisplay({
				id: displayId2,
				role: DisplayRole.ROOM,
				spaceId: spaceId2,
			});

			const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1), createMockPage(spacePageId2, 2)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			// Mock space pages query - returns pages for both spaces
			jest.spyOn(dataSource, 'query').mockResolvedValue([
				{ id: spacePageId, spaceId: spaceId },
				{ id: spacePageId2, spaceId: spaceId2 },
			]);

			const result = await service.resolveHomePagesBatch([display1, display2]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(spacePageId);
			expect(result.get(displayId)?.resolutionMode).toBe('auto_role');
			expect(result.get(displayId2)?.pageId).toBe(spacePageId2);
			expect(result.get(displayId2)?.resolutionMode).toBe('auto_role');
		});

		it('should handle mixed roles in batch (room + master)', async () => {
			const roomDisplay = createMockDisplay({
				id: displayId,
				role: DisplayRole.ROOM,
				spaceId: spaceId,
			});

			const masterDisplay = createMockDisplay({
				id: displayId2,
				role: DisplayRole.MASTER,
			});

			const pages = [
				createMockPage(pageId1, 0),
				createMockPage(spacePageId, 1),
				createMockPage(houseOverviewPageId, 2),
			];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			// Mock queries - first for space pages, second for house overview
			jest
				.spyOn(dataSource, 'query')
				.mockResolvedValueOnce([{ id: spacePageId, spaceId: spaceId }]) // Space pages
				.mockResolvedValueOnce([{ id: houseOverviewPageId }]); // House overview

			const result = await service.resolveHomePagesBatch([roomDisplay, masterDisplay]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(spacePageId);
			expect(result.get(displayId)?.resolutionMode).toBe('auto_role');
			expect(result.get(displayId2)?.pageId).toBe(houseOverviewPageId);
			expect(result.get(displayId2)?.resolutionMode).toBe('auto_role');
		});

		it('should handle explicit home mode in batch', async () => {
			const explicitDisplay = createMockDisplay({
				id: displayId,
				homeMode: HomeMode.EXPLICIT,
				homePageId: pageId1,
			});

			const roomDisplay = createMockDisplay({
				id: displayId2,
				role: DisplayRole.ROOM,
				spaceId: spaceId,
			});

			const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: spacePageId, spaceId: spaceId }]);

			const result = await service.resolveHomePagesBatch([explicitDisplay, roomDisplay]);

			expect(result.size).toBe(2);
			expect(result.get(displayId)?.pageId).toBe(pageId1);
			expect(result.get(displayId)?.resolutionMode).toBe('explicit');
			expect(result.get(displayId2)?.pageId).toBe(spacePageId);
			expect(result.get(displayId2)?.resolutionMode).toBe('auto_role');
		});

		it('should handle legacy auto_space mode in batch for non-room roles', async () => {
			const masterWithAutoSpace = createMockDisplay({
				id: displayId,
				role: DisplayRole.MASTER,
				homeMode: HomeMode.AUTO_SPACE,
				spaceId: spaceId,
			});

			const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			// First call for space pages (for auto_space mode), second for house overview (for master role)
			jest
				.spyOn(dataSource, 'query')
				.mockResolvedValueOnce([{ id: spacePageId, spaceId: spaceId }]) // Space pages
				.mockResolvedValueOnce([]); // No house overview

			const result = await service.resolveHomePagesBatch([masterWithAutoSpace]);

			expect(result.size).toBe(1);
			// Should fall back to auto_space since no house overview exists
			expect(result.get(displayId)?.pageId).toBe(spacePageId);
			expect(result.get(displayId)?.resolutionMode).toBe('auto_space');
		});

		it('should fallback gracefully when no matching pages exist', async () => {
			const display = createMockDisplay({
				id: displayId,
				role: DisplayRole.ROOM,
				spaceId: spaceId,
			});

			// Only generic pages, no space pages
			const pages = [createMockPage(pageId1, 0), createMockPage(pageId2, 1)];

			const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
			mockQueryBuilder.getMany.mockResolvedValue(pages);

			// No space pages found
			jest.spyOn(dataSource, 'query').mockResolvedValue([]);

			const result = await service.resolveHomePagesBatch([display]);

			expect(result.size).toBe(1);
			expect(result.get(displayId)?.pageId).toBe(pageId1);
			expect(result.get(displayId)?.resolutionMode).toBe('fallback');
		});

		it('should respect page visibility in batch operations', async () => {
			const displayEntity1 = { id: displayId } as DisplayEntity;
			const displayEntity2 = { id: displayId2 } as DisplayEntity;

			const display1 = createMockDisplay({
				id: displayId,
				role: DisplayRole.ROOM,
			});

			const display2 = createMockDisplay({
				id: displayId2,
				role: DisplayRole.ROOM,
			});

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
