import { Test, TestingModule } from '@nestjs/testing';

import { ScenesNotEditableException, ScenesNotFoundException } from '../scenes.exceptions';

import { ScenesBulkService } from './scenes-bulk.service';
import { ScenesService } from './scenes.service';

describe('ScenesBulkService', () => {
	let service: ScenesBulkService;
	let scenesService: { remove: jest.Mock; update: jest.Mock };

	beforeEach(async () => {
		scenesService = {
			remove: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [ScenesBulkService, { provide: ScenesService, useValue: scenesService }],
		}).compile();

		service = module.get<ScenesBulkService>(ScenesBulkService);
	});

	describe('remove', () => {
		it('removes every scene in the selection', async () => {
			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(scenesService.remove).toHaveBeenCalledTimes(3);
		});

		// A scene the module refuses to delete - a non-editable one - explains why,
		// and that explanation is more use to the operator than "failed".
		it('carries the service refusal through as the reason', async () => {
			scenesService.remove.mockImplementation((id: string) =>
				id === 'b'
					? Promise.reject(new ScenesNotEditableException('Scene with id=b cannot be deleted.'))
					: Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Scene with id=b cannot be deleted.' }]);
		});
	});

	describe('setEnabled', () => {
		it('sets the requested state on every scene', async () => {
			const result = await service.setEnabled(['a', 'b'], false);

			expect(result.succeeded).toEqual(['a', 'b']);
			expect(scenesService.update).toHaveBeenCalledTimes(2);
			expect(scenesService.update).toHaveBeenCalledWith('a', { enabled: false });
			expect(scenesService.update).toHaveBeenCalledWith('b', { enabled: false });
		});

		// Only `enabled` may travel: the bulk endpoint is a toggle, not a way to
		// edit a scene's other fields for a whole selection at once.
		it('sends nothing but the enabled flag', async () => {
			await service.setEnabled(['a'], true);

			const [, dto] = scenesService.update.mock.calls[0] as [string, Record<string, unknown>];

			expect(Object.keys(dto)).toEqual(['enabled']);
		});

		it('reports a scene the service refused', async () => {
			scenesService.update.mockRejectedValue(new ScenesNotFoundException('Scene with id=a was not found.'));

			const result = await service.setEnabled(['a'], true);

			expect(result.succeeded).toEqual([]);
			expect(result.failed).toEqual([{ id: 'a', reason: 'Scene with id=a was not found.' }]);
		});
	});
});
