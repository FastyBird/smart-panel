import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpacesService } from '../../spaces/services/spaces.service';
import { SceneEntity } from '../entities/scenes.entity';
import { SceneCategory } from '../scenes.constants';

import { SceneActionsService } from './scene-actions.service';
import { ScenesService } from './scenes.service';

describe('ScenesService', () => {
	it('returns bounded FTS-ranked scene metadata without excluding disabled or non-triggerable scenes', async () => {
		const dataSource = {
			query: jest
				.fn()
				.mockResolvedValueOnce([
					{
						id: 'scene-id',
						name: 'Quiet evening',
						category: 'generic',
						enabled: 0,
						triggerable: 0,
						primarySpaceId: 'space-id',
						rankTier: '0',
						lexicalScore: '-3.25',
					},
				])
				.mockResolvedValueOnce([{ total: '2' }]),
		};
		const service = new ScenesService(
			{} as Repository<SceneEntity>,
			{} as SceneActionsService,
			{} as SpacesService,
			dataSource as unknown as DataSource,
			{} as EventEmitter2,
		);

		await expect(
			service.searchSummaryPage({
				match: '"quiet"*',
				rawQuery: 'scene-id',
				normalizedQuery: 'quiet',
				offset: 1,
				limit: 20,
				primarySpaceId: 'floor-id',
				primarySpaceParentId: 'floor-id',
				categories: [SceneCategory.GENERIC],
			}),
		).resolves.toEqual({
			scenes: [
				expect.objectContaining({
					id: 'scene-id',
					enabled: false,
					triggerable: false,
					rankTier: 0,
					lexicalScore: -3.25,
				}),
			],
			total: 2,
		});
		const [selectSql, selectParameters] = dataSource.query.mock.calls[0] as [string, unknown[]];
		const [countSql, countParameters] = dataSource.query.mock.calls[1] as [string, unknown[]];
		expect(selectSql).toContain('home_context_entity_search_fts MATCH ?');
		expect(selectSql).toContain('(scene."primarySpaceId" = ? OR scene."primarySpaceId" IN (SELECT scoped_space.id');
		expect(selectSql).toContain('scoped_space."parentId" = ?)');
		expect(selectSql).toContain('scene.category IN (?)');
		expect(selectSql).not.toContain('scene.enabled = 1');
		expect(selectSql).not.toContain('scene.triggerable = 1');
		expect(selectSql).toContain('WHEN scene.id = ? COLLATE NOCASE THEN 0');
		expect(selectSql).toContain('FROM home_context_entity_search_vocab exact_count');
		expect(selectSql).toContain('ORDER BY "rankTier" ASC, "lexicalScore" ASC, LOWER(scene.name) ASC, scene.id ASC');
		expect(selectParameters).toEqual([
			'scene-id',
			1,
			'quiet',
			1,
			'quiet%',
			'scene',
			'"quiet"*',
			'floor-id',
			'floor-id',
			'generic',
			20,
			1,
		]);
		expect(countSql).toContain('SELECT COUNT(*) AS total');
		expect(countParameters).toEqual(['scene', '"quiet"*', 'floor-id', 'floor-id', 'generic']);
	});

	it('filters trigger candidates by enabled and triggerable state before paging and counting', async () => {
		const dataSource = {
			query: jest
				.fn()
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ total: 0 }]),
		};
		const service = new ScenesService(
			{} as Repository<SceneEntity>,
			{} as SceneActionsService,
			{} as SpacesService,
			dataSource as unknown as DataSource,
			{} as EventEmitter2,
		);

		await service.searchSummaryPage({
			match: '"movie"*',
			offset: 4,
			limit: 10,
			primarySpaceId: 'space-id',
			categories: [SceneCategory.GENERIC],
			candidateTrigger: true,
		});

		const [selectSql, selectParameters] = dataSource.query.mock.calls[0] as [string, unknown[]];
		const [countSql, countParameters] = dataSource.query.mock.calls[1] as [string, unknown[]];
		for (const sql of [selectSql, countSql]) {
			expect(sql).toContain('scene."primarySpaceId" = ?');
			expect(sql).toContain('scene.category IN (?)');
			expect(sql).toContain('scene.enabled = 1');
			expect(sql).toContain('scene.triggerable = 1');
		}
		expect(selectParameters).toEqual([null, 'scene', '"movie"*', 'space-id', 'generic', 10, 4]);
		expect(countParameters).toEqual(['scene', '"movie"*', 'space-id', 'generic']);
	});

	it('includes disabled scenes in summary queries', async () => {
		const disabledScene = { id: 'disabled-scene', name: 'Disabled scene', enabled: false } as SceneEntity;
		const query = {
			select: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[disabledScene], 1]),
		};
		const repository = {
			createQueryBuilder: jest.fn().mockReturnValue(query),
		} as unknown as Repository<SceneEntity>;
		const service = new ScenesService(
			repository,
			{} as SceneActionsService,
			{} as SpacesService,
			{} as DataSource,
			{} as EventEmitter2,
		);

		await expect(service.findSummaryPage(50)).resolves.toEqual({ scenes: [disabledScene], total: 1 });
		expect(query.where).not.toHaveBeenCalled();
		expect(query.select).toHaveBeenCalledWith(expect.arrayContaining(['scene.enabled']));
	});

	it('applies the summary cap without loading scene actions', async () => {
		const scene = { id: 'scene-id', name: 'Movie night' } as SceneEntity;
		const query = {
			select: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[scene], 60]),
		};
		const repository = {
			createQueryBuilder: jest.fn().mockReturnValue(query),
		} as unknown as Repository<SceneEntity>;
		const service = new ScenesService(
			repository,
			{} as SceneActionsService,
			{} as SpacesService,
			{} as DataSource,
			{} as EventEmitter2,
		);

		await expect(service.findSummaryPage(50, 'space-id')).resolves.toEqual({ scenes: [scene], total: 60 });
		expect(query.select).toHaveBeenCalledWith(expect.not.arrayContaining(['scene.actions']));
		expect(query.orderBy).toHaveBeenCalledWith('scene.name', 'ASC');
		expect(query.where).toHaveBeenCalledWith('scene.primarySpaceId = :primarySpaceId', {
			primarySpaceId: 'space-id',
		});
		expect(query.take).toHaveBeenCalledWith(50);
	});

	it('includes floor and child-room scenes in a scoped summary', async () => {
		const scene = { id: 'scene-id', name: 'Morning' } as SceneEntity;
		const query = {
			select: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[scene], 1]),
		};
		const repository = {
			createQueryBuilder: jest.fn().mockReturnValue(query),
		} as unknown as Repository<SceneEntity>;
		const service = new ScenesService(
			repository,
			{} as SceneActionsService,
			{} as SpacesService,
			{} as DataSource,
			{} as EventEmitter2,
		);

		await service.findSummaryPage(50, ['floor-id', 'room-1', 'room-2']);

		expect(query.where).toHaveBeenCalledWith('scene.primarySpaceId IN (:...primarySpaceIds)', {
			primarySpaceIds: ['floor-id', 'room-1', 'room-2'],
		});
	});

	it('returns only bounded enabled and triggerable scene summaries', async () => {
		const scene = { id: 'scene-id', name: 'Morning' } as SceneEntity;
		const query = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
			take: jest.fn().mockReturnThis(),
			getManyAndCount: jest.fn().mockResolvedValue([[scene], 1]),
		};
		const repository = {
			createQueryBuilder: jest.fn().mockReturnValue(query),
		} as unknown as Repository<SceneEntity>;
		const service = new ScenesService(
			repository,
			{} as SceneActionsService,
			{} as SpacesService,
			{} as DataSource,
			{} as EventEmitter2,
		);

		await expect(service.findTriggerableSummaryPage(50)).resolves.toEqual({ scenes: [scene], total: 1 });
		expect(query.where).toHaveBeenCalledWith('scene.enabled = :enabled', { enabled: true });
		expect(query.andWhere).toHaveBeenCalledWith('scene.triggerable = :triggerable', { triggerable: true });
		expect(query.orderBy).toHaveBeenCalledWith('scene.name', 'ASC');
		expect(query.addOrderBy).toHaveBeenCalledWith('scene.id', 'ASC');
		expect(query.take).toHaveBeenCalledWith(50);
	});
});
