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

		describe('when homeMode is auto_space', () => {
			it('should return space page if display has spaceId and SpacePage exists', async () => {
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
					spaceId: spaceId,
				});

				const pages = [createMockPage(pageId1, 0), createMockPage(spacePageId, 1)];

				const mockQueryBuilder = pagesRepository.createQueryBuilder() as jest.Mocked<SelectQueryBuilder<PageEntity>>;
				mockQueryBuilder.getMany.mockResolvedValue(pages);

				// Mock the space page query
				jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: spacePageId }]);

				const result = await service.resolveHomePage(display);

				expect(result.pageId).toBe(spacePageId);
				expect(result.resolutionMode).toBe('auto_space');
				expect(result.reason).toContain('SpacePage');
			});

			it('should fallback to first page if no SpacePage exists for space', async () => {
				const display = createMockDisplay({
					homeMode: HomeMode.AUTO_SPACE,
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
					homeMode: HomeMode.AUTO_SPACE,
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
	});
});
