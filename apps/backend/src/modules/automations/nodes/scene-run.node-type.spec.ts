import { ScenesRunRefusedException } from '../../scenes/scenes.exceptions';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { SCENE_ID, abortedSignal, runContext } from '../testing/node-fixtures';

import {
	SCENE_RUN_NODE_TYPE,
	SCENE_RUN_TIMEOUT_SECONDS,
	SceneRunConfigDto,
	SceneRunOutcome,
	createSceneRunNodeType,
} from './scene-run.node-type';

describe('scene.run', () => {
	let triggerScene: jest.Mock<Promise<SceneRunOutcome>, [string, string?]>;

	const card = () => createSceneRunNodeType({ triggerScene });

	const execute = (context = runContext()) => card().execute({ scene_id: SCENE_ID }, context);

	beforeEach(() => {
		triggerScene = jest.fn<Promise<SceneRunOutcome>, [string, string?]>(() =>
			Promise.resolve({ status: 'completed', error: null }),
		);
	});

	it('is an action with a done and an error output that lists its scene', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SCENE_RUN_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
		});
		expect(registered.references({ scene_id: SCENE_ID })).toEqual([{ kind: 'scene', id: SCENE_ID }]);
		expect(registered.references({})).toEqual([]);
		expect(card().timeoutSeconds).toBe(SCENE_RUN_TIMEOUT_SECONDS);
	});

	it('needs a scene and takes nothing else', async () => {
		expect(await card().validateConfig({ scene_id: SCENE_ID })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([{ field: 'scene_id', reason: 'A scene must be chosen.' }]);
		expect(await card().validateConfig({ scene_id: 'evening' })).toEqual([
			{ field: 'scene_id', reason: 'A scene must be chosen.' },
		]);
		expect(await card().validateConfig({ scene_id: SCENE_ID, wait: false })).toEqual([
			{ field: 'wait', reason: 'This property is not allowed.' },
		]);
		expect(card().configSchema).toMatchObject({
			required: ['scene_id'],
			additionalProperties: false,
			properties: { scene_id: { type: 'string', format: 'uuid' } },
		});
	});

	it('runs the scene, labelled as run by an automation', async () => {
		expect(await execute()).toEqual({ success: true });
		expect(triggerScene).toHaveBeenCalledWith(SCENE_ID, 'automation');
	});

	it.each([
		['partially_completed', '1 action(s) failed: Device is offline', '1 action(s) failed: Device is offline'],
		['failed', 'All actions failed', 'All actions failed'],
		['failed', null, 'The scene ended as failed.'],
	])('takes the error output for a scene that ended as %s', async (status, error, reason) => {
		triggerScene.mockResolvedValue({ status, error });

		expect(await execute()).toEqual({ success: false, reason });
	});

	it('takes the error output for a scene that can not be run', async () => {
		triggerScene.mockRejectedValue(new Error(`Scene with id=${SCENE_ID} is disabled.`));

		expect(await execute()).toEqual({ success: false, reason: `Scene with id=${SCENE_ID} is disabled.` });
	});

	it('marks a scene the scene runner refused as refused, not as a failed run', async () => {
		triggerScene.mockRejectedValue(new ScenesRunRefusedException('An automation can not unlock a lock.'));

		expect(await execute()).toEqual({
			success: false,
			reason: 'An automation can not unlock a lock.',
			refused: true,
		});
	});

	it('does not start the scene for a run that was cancelled before it got here', async () => {
		expect(await execute(runContext({ signal: abortedSignal() }))).toMatchObject({ success: false });
		expect(triggerScene).not.toHaveBeenCalled();
	});

	it('says which scene it runs, so the safety policy can open it', () => {
		const card = createSceneRunNodeType({ triggerScene: jest.fn() });

		expect(card.commands?.({ scene_id: SCENE_ID })).toEqual([
			{ kind: 'scene_run', sceneId: SCENE_ID, field: 'scene_id' },
		]);
		expect(card.commands?.({} as SceneRunConfigDto)).toEqual([]);
		expect(card.commands?.(null as unknown as SceneRunConfigDto)).toEqual([]);
	});
});
