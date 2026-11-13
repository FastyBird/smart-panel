import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SPACE_MODE_CHANGED_NODE_TYPE, createSpaceModeChangedNodeType } from './space-mode-changed.node-type';
import { SpaceModeReading } from './space-mode-is.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('space.mode.changed', () => {
	let reading: SpaceModeReading | Error;
	let listeners: Set<() => void>;
	let failures: unknown[];

	const card = () =>
		createSpaceModeChangedNodeType(
			{
				activeMode: () => (reading instanceof Error ? Promise.reject(reading) : Promise.resolve(reading)),
				onModeChanged: (spaceId, listener) => {
					if (spaceId !== SPACE) return () => undefined;

					listeners.add(listener);

					return () => listeners.delete(listener);
				},
			},
			(error) => failures.push(error),
		);

	const select = async (mode: ActivityMode | null | Error, status = ActivityActivationStatus.ACTIVE): Promise<void> => {
		reading =
			mode instanceof Error
				? mode
				: {
						mode,
						status: mode === null ? ActivityActivationStatus.DEACTIVATED : status,
						activationId: `activation-${String(mode)}`,
						actor: 'user:1',
					};

		for (const listener of [...listeners]) listener();

		await flush();
	};

	beforeEach(() => {
		reading = { mode: null, status: null, activationId: null, actor: null };
		listeners = new Set();
		failures = [];
	});

	it('is a trigger of the plugin that refers to its space', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_MODE_CHANGED_NODE_TYPE,
			kind: 'trigger',
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE })).toEqual([{ kind: 'space', id: SPACE }]);
	});

	it('needs a space and takes an optional mode to change to and from', async () => {
		expect(await card().validateConfig({ space_id: SPACE })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, to: ActivityMode.SLEEP, from: ActivityMode.RELAX })).toEqual(
			[],
		);
		expect(await card().validateConfig({ space_id: SPACE, to: 'party' })).toEqual([
			{ field: 'to', reason: '"to" must be one of work, relax, sleep, entertainment, away.' },
		]);
		expect(await card().validateConfig({ space_id: SPACE, to: ActivityMode.AWAY, from: ActivityMode.AWAY })).toEqual([
			{ field: 'to', reason: 'The activity mode can not change to the mode it changes from.' },
		]);
		expect(await card().validateConfig({ to: ActivityMode.AWAY })).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
	});

	it('starts on every change of the selection, a cleared one included, but not on the one it was armed with', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE }, fire);
		await flush();

		expect(fire).not.toHaveBeenCalled();

		await select(ActivityMode.WORK, ActivityActivationStatus.ACTIVATING);
		// The second event of the same activation is no change
		await select(ActivityMode.WORK, ActivityActivationStatus.ACTIVE);
		await select(ActivityMode.SLEEP);
		await select(null);

		expect(fire.mock.calls).toEqual([
			[{ space_id: SPACE, from: null, to: ActivityMode.WORK }],
			[{ space_id: SPACE, from: ActivityMode.WORK, to: ActivityMode.SLEEP }],
			[{ space_id: SPACE, from: ActivityMode.SLEEP, to: null }],
		]);
	});

	it('starts only on a change into and out of the modes asked for', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE, to: ActivityMode.SLEEP, from: ActivityMode.RELAX }, fire);
		await flush();

		await select(ActivityMode.SLEEP);
		await select(ActivityMode.RELAX);
		await select(null);
		await select(ActivityMode.RELAX);
		await select(ActivityMode.SLEEP);

		expect(fire.mock.calls).toEqual([[{ space_id: SPACE, from: ActivityMode.RELAX, to: ActivityMode.SLEEP }]]);
	});

	it('takes a selection that can not be read as no state', async () => {
		const fire = jest.fn();

		reading = new Error('Space not found');
		card().subscribe({ space_id: SPACE }, fire);
		await flush();
		await select(ActivityMode.WORK);
		await select(new Error('Space not found'));
		await select(ActivityMode.WORK);

		expect(fire).not.toHaveBeenCalled();
		expect(failures).toHaveLength(2);
	});

	it('stops listening when it is released', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE }, fire)();
		await select(ActivityMode.WORK);

		expect(fire).not.toHaveBeenCalled();
		expect(listeners.size).toBe(0);
	});
});
