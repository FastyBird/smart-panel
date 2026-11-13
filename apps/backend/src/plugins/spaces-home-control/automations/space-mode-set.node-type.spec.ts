import { ConflictException } from '@nestjs/common';

import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { abortedSignal, runContext } from '../../../modules/automations/testing/node-fixtures';
import { AutomationActivityAdmission } from '../activity/automation-activity';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SpaceModeReading } from './space-mode-is.node-type';
import {
	SPACE_MODE_SET_NODE_TYPE,
	SpaceModeConfiguration,
	createSpaceModeSetNodeType,
} from './space-mode-set.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';
const ACTOR = 'automation:automation-1:run-1';

describe('space.mode.set', () => {
	let current: SpaceModeReading;
	let configuration: SpaceModeConfiguration;
	let activateMode: jest.Mock<
		Promise<SpaceModeReading>,
		[string, ActivityMode, number, string, AutomationActivityAdmission]
	>;

	const card = () =>
		createSpaceModeSetNodeType({
			activeMode: () => Promise.resolve(current),
			modeConfiguration: () => Promise.resolve(configuration),
			activateMode,
		});

	beforeEach(() => {
		current = {
			mode: ActivityMode.WORK,
			status: ActivityActivationStatus.ACTIVE,
			activationId: 'a-1',
			actor: 'user:1',
		};
		configuration = { enabled: true, revision: 3 };
		activateMode = jest.fn<
			Promise<SpaceModeReading>,
			[string, ActivityMode, number, string, AutomationActivityAdmission]
		>((_spaceId, mode, _revision, actor) =>
			Promise.resolve({ mode, status: ActivityActivationStatus.ACTIVE, activationId: 'a-2', actor }),
		);
	});

	it('is an action of the plugin with a done and an error output that does not act on a device itself', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_MODE_SET_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE, mode: ActivityMode.SLEEP })).toEqual([
			{ kind: 'space', id: SPACE },
		]);
		expect(registered.commands({ space_id: SPACE, mode: ActivityMode.SLEEP })).toEqual([]);
	});

	it('needs a space and one activity mode', async () => {
		expect(await card().validateConfig({ space_id: SPACE, mode: ActivityMode.SLEEP })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE })).toEqual([
			{ field: 'mode', reason: 'The activity mode must be one of work, relax, sleep, entertainment, away.' },
		]);
		expect(await card().validateConfig({ mode: ActivityMode.SLEEP })).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
	});

	it('activates the mode as an automatic source, over the selection it read, as the automation run', async () => {
		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: true,
		});

		expect(activateMode).toHaveBeenCalledWith(SPACE, ActivityMode.SLEEP, 3, ACTOR, {
			previousActivationId: 'a-1',
			isCurrent: expect.any(Function) as unknown,
		});
	});

	it('activates over no selection at all', async () => {
		current = { mode: null, status: null, activationId: null, actor: null };

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: true,
		});
		expect(activateMode.mock.calls[0][4].previousActivationId).toBeNull();
	});

	it('hands on whether the run is still going, for the last check before the selection is written', async () => {
		const controller = new AbortController();

		await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext({ signal: controller.signal }));

		const admission = activateMode.mock.calls[0][4];

		expect(admission.isCurrent()).toBe(true);

		controller.abort();

		expect(admission.isCurrent()).toBe(false);
	});

	it('leaves a mode that is already selected and active, or on its way, alone', async () => {
		for (const status of [
			ActivityActivationStatus.ACTIVE,
			ActivityActivationStatus.PARTIAL,
			ActivityActivationStatus.ACTIVATING,
		]) {
			current = { mode: ActivityMode.SLEEP, status, activationId: 'a-1', actor: 'schedule:s:o' };

			expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
				success: true,
			});
		}

		expect(activateMode).not.toHaveBeenCalled();
	});

	it('activates a selected mode again when its last activation failed or was interrupted', async () => {
		current = { mode: ActivityMode.SLEEP, status: ActivityActivationStatus.FAILED, activationId: 'a-1', actor: 'x' };

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: true,
		});
		expect(activateMode).toHaveBeenCalledTimes(1);
	});

	it('does not activate a mode that is disabled in the space', async () => {
		configuration = { enabled: false, revision: 3 };

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: false,
			reason: 'The space mode was not set: the sleep mode is disabled in the space.',
		});
		expect(activateMode).not.toHaveBeenCalled();
	});

	it('takes the error output when the activation is refused: a concurrent one, or a newer selection', async () => {
		activateMode.mockRejectedValue(new ConflictException('A newer activity selection superseded the automation'));

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: false,
			reason: 'The space mode was not set: A newer activity selection superseded the automation',
		});
	});

	it('takes the error output when a newer selection replaced the mode before it was activated', async () => {
		activateMode.mockResolvedValue({
			mode: ActivityMode.RELAX,
			status: ActivityActivationStatus.ACTIVE,
			activationId: 'a-3',
			actor: 'user:2',
		});

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: false,
			reason: 'A newer activity selection replaced the mode before it was activated.',
		});
	});

	it('takes the error output when a domain of the mode failed, though the mode stays selected', async () => {
		activateMode.mockImplementation((_spaceId, mode, _revision, actor) =>
			Promise.resolve({ mode, status: ActivityActivationStatus.PARTIAL, activationId: 'a-2', actor }),
		);

		expect(await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: false,
			reason: 'The sleep mode was selected, but its activation ended as partial.',
		});
	});

	it('takes the error output when the space or the mode can not be read', async () => {
		const failing = createSpaceModeSetNodeType({
			activeMode: () => Promise.reject(new Error('Activity modes support rooms and zones only')),
			modeConfiguration: () => Promise.resolve(configuration),
			activateMode,
		});

		expect(await failing.execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: false,
			reason: 'The space mode was not set: Activity modes support rooms and zones only',
		});
		expect(activateMode).not.toHaveBeenCalled();
	});

	it('does not activate for a run that was cancelled before it got here', async () => {
		expect(
			await card().execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext({ signal: abortedSignal() })),
		).toMatchObject({ success: false });
		expect(activateMode).not.toHaveBeenCalled();
	});

	it('does not activate for a run that was cancelled while the selection was read', async () => {
		const controller = new AbortController();
		const reading = createSpaceModeSetNodeType({
			activeMode: () => {
				controller.abort();

				return Promise.resolve(current);
			},
			modeConfiguration: () => Promise.resolve(configuration),
			activateMode,
		});

		expect(
			await reading.execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext({ signal: controller.signal })),
		).toEqual({ success: false, reason: 'The run was cancelled before the space mode was set.' });
		expect(activateMode).not.toHaveBeenCalled();
	});
});
