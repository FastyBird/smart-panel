import { normalizeAutomationNodeType } from '../graph/node-type';
import { SCENE_ID } from '../testing/node-fixtures';

import { SceneRunEvent } from './bus-events.types';
import { SCENE_WAS_RUN_NODE_TYPE, createSceneWasRunNodeType } from './scene-was-run.node-type';

const OTHER_SCENE = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0d000002';

describe('scene.was-run', () => {
	let listeners: Set<(run: SceneRunEvent) => void>;

	const card = () =>
		createSceneWasRunNodeType({
			onSceneRun: (listener) => {
				listeners.add(listener);

				return () => listeners.delete(listener);
			},
		});

	const run = (event: SceneRunEvent): void => {
		for (const listener of [...listeners]) listener(event);
	};

	beforeEach(() => {
		listeners = new Set();
	});

	it('is a trigger that refers to its scene', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({ type: SCENE_WAS_RUN_NODE_TYPE, kind: 'trigger' });
		expect(registered.references({ scene_id: SCENE_ID })).toEqual([{ kind: 'scene', id: SCENE_ID }]);
	});

	it('needs a scene and takes nothing else', async () => {
		expect(await card().validateConfig({ scene_id: SCENE_ID })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([{ field: 'scene_id', reason: 'A scene must be chosen.' }]);
		expect(await card().validateConfig({ scene_id: SCENE_ID, status: 'completed' })).toEqual([
			{ field: 'status', reason: 'This property is not allowed.' },
		]);
	});

	it('starts when the scene was run, however it ended and whoever ran it', () => {
		const fire = jest.fn();

		card().subscribe({ scene_id: SCENE_ID }, fire);

		run({ sceneId: SCENE_ID, status: 'completed', triggeredBy: 'panel' });
		run({ sceneId: OTHER_SCENE, status: 'completed', triggeredBy: null });
		run({ sceneId: SCENE_ID, status: 'failed', triggeredBy: null });

		expect(fire.mock.calls).toEqual([
			[{ scene_id: SCENE_ID, status: 'completed', triggered_by: 'panel' }],
			[{ scene_id: SCENE_ID, status: 'failed', triggered_by: null }],
		]);
	});

	it('stops listening when it is released', () => {
		const fire = jest.fn();

		card().subscribe({ scene_id: SCENE_ID }, fire)();
		run({ sceneId: SCENE_ID, status: 'completed', triggeredBy: null });

		expect(fire).not.toHaveBeenCalled();
	});
});
