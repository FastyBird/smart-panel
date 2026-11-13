import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { runContext } from '../../../modules/automations/testing/node-fixtures';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SPACE_MODE_IS_NODE_TYPE, SpaceModeReading, createSpaceModeIsNodeType } from './space-mode-is.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';

const selected = (mode: ActivityMode | null): SpaceModeReading => ({
	mode,
	status: mode === null ? ActivityActivationStatus.DEACTIVATED : ActivityActivationStatus.ACTIVE,
	activationId: 'activation-1',
	actor: 'user:1',
});

describe('space.mode.is', () => {
	let reading: SpaceModeReading | Error;

	const card = () =>
		createSpaceModeIsNodeType({
			activeMode: () => (reading instanceof Error ? Promise.reject(reading) : Promise.resolve(reading)),
		});

	beforeEach(() => {
		reading = selected(ActivityMode.SLEEP);
	});

	it('is a condition of the plugin that refers to its space', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_MODE_IS_NODE_TYPE,
			kind: 'condition',
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE, modes: [ActivityMode.SLEEP] })).toEqual([
			{ kind: 'space', id: SPACE },
		]);
	});

	it('needs a space and one or more activity modes, each once', async () => {
		const reason = 'Choose one or more of the activity modes work, relax, sleep, entertainment, away, each once.';

		expect(await card().validateConfig({ space_id: SPACE, modes: [ActivityMode.SLEEP, ActivityMode.AWAY] })).toEqual(
			[],
		);
		expect(await card().validateConfig({ space_id: SPACE, modes: [] })).toEqual([{ field: 'modes', reason }]);
		expect(await card().validateConfig({ space_id: SPACE, modes: ['party'] })).toEqual([{ field: 'modes', reason }]);
		expect(await card().validateConfig({ space_id: SPACE, modes: [ActivityMode.SLEEP, ActivityMode.SLEEP] })).toEqual([
			{ field: 'modes', reason },
		]);
		expect(await card().validateConfig({ modes: [ActivityMode.SLEEP] })).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
	});

	it('answers whether the selected mode is one of the chosen ones', async () => {
		expect(
			await card().evaluate({ space_id: SPACE, modes: [ActivityMode.SLEEP, ActivityMode.AWAY] }, runContext()),
		).toEqual({ result: true, observed: ActivityMode.SLEEP });
		expect(await card().evaluate({ space_id: SPACE, modes: [ActivityMode.WORK] }, runContext())).toEqual({
			result: false,
			observed: ActivityMode.SLEEP,
		});
	});

	it('evaluates to no while no mode is selected', async () => {
		reading = selected(null);

		expect(await card().evaluate({ space_id: SPACE, modes: [...Object.values(ActivityMode)] }, runContext())).toEqual({
			result: false,
			observed: null,
			reason: 'No activity mode is selected in the space.',
		});
	});

	it('evaluates to no when the selection can not be read', async () => {
		reading = new Error('Space not found');

		expect(await card().evaluate({ space_id: SPACE, modes: [ActivityMode.SLEEP] }, runContext())).toEqual({
			result: false,
			reason: 'The activity mode of the space could not be read: Space not found',
		});
	});
});
