import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpacesService } from '../../spaces/services/spaces.service';
import { SceneEntity } from '../entities/scenes.entity';

import { SceneActionsService } from './scene-actions.service';
import { ScenesService } from './scenes.service';

describe('ScenesService', () => {
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
		expect(query.where).toHaveBeenCalledWith('scene.primarySpaceId = :primarySpaceId', {
			primarySpaceId: 'space-id',
		});
		expect(query.take).toHaveBeenCalledWith(50);
	});
});
