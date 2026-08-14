import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpacesService } from '../../spaces/services/spaces.service';
import { SceneEntity } from '../entities/scenes.entity';

import { SceneActionsService } from './scene-actions.service';
import { ScenesService } from './scenes.service';

describe('ScenesService', () => {
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
		expect(query.take).toHaveBeenCalledWith(50);
	});
});
