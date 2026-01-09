/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { ScenesService } from '../../../modules/scenes/services/scenes.service';
import { SceneTileEntity } from '../entities/tiles-scene.entity';

import { TileRelationsLoaderService } from './tile-relations-loader.service';

describe('TileRelationsLoaderService', () => {
	let service: TileRelationsLoaderService;
	let scenesService: ScenesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TileRelationsLoaderService,
				{
					provide: ScenesService,
					useValue: {
						findOne: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get(TileRelationsLoaderService);
		scenesService = module.get(ScenesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(scenesService).toBeDefined();
	});

	it('should return true for supported entity type', () => {
		const tile = new SceneTileEntity();
		expect(service.supports(tile)).toBe(true);
	});

	it('should return false for unsupported entity type', () => {
		const tile = {} as TileEntity;
		expect(service.supports(tile)).toBe(false);
	});

	it('should load and assign scene when sceneId is valid UUID', async () => {
		const tile = new SceneTileEntity();
		const sceneId = uuid();

		tile.sceneId = sceneId;

		const mockScene = { id: sceneId };
		jest.spyOn(scenesService, 'findOne').mockResolvedValueOnce(mockScene as SceneEntity);

		await service.loadRelations(tile);

		expect(scenesService.findOne).toHaveBeenCalledWith(sceneId);
		expect(tile.scene).toEqual(mockScene);
	});

	it('should not load scene if sceneId is invalid', async () => {
		const tile = new SceneTileEntity();
		tile.sceneId = 'invalid-uuid';

		await service.loadRelations(tile);

		expect(scenesService.findOne).not.toHaveBeenCalled();
		expect(tile.scene).toBeUndefined();
	});

	it('should not load scene if sceneId is undefined', async () => {
		const tile = new SceneTileEntity();

		await service.loadRelations(tile);

		expect(scenesService.findOne).not.toHaveBeenCalled();
		expect(tile.scene).toBeUndefined();
	});
});
