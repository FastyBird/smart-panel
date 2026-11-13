import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { abortedSignal, runContext } from '../../../modules/automations/testing/node-fixtures';
import { INTENT_ORIGIN_AUTOMATION } from '../../../modules/intents/intents.constants';
import { IntentContext } from '../../../modules/intents/models/intent.model';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { IntentExecutionResult } from '../services/space-intent-base.service';
import {
	LightingIntentType,
	LightingMode,
	LightingRole,
	SPACES_HOME_CONTROL_PLUGIN_NAME,
} from '../spaces-home-control.constants';

import { SPACE_LIGHTING_INTENT_NODE_TYPE, createSpaceLightingIntentNodeType } from './space-lighting-intent.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';

describe('space.lighting.intent', () => {
	let executeLightingIntent: jest.Mock<
		Promise<IntentExecutionResult | null>,
		[string, LightingIntentDto, IntentContext]
	>;

	const card = () => createSpaceLightingIntentNodeType({ executeLightingIntent });

	beforeEach(() => {
		executeLightingIntent = jest.fn<Promise<IntentExecutionResult | null>, [string, LightingIntentDto, IntentContext]>(
			() => Promise.resolve({ success: true, affectedDevices: 2, failedDevices: 0, skippedOfflineDevices: 0 }),
		);
	});

	it('is an action of the plugin that refers to its space and declares no device write', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_LIGHTING_INTENT_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE, intent: 'off' })).toEqual([{ kind: 'space', id: SPACE }]);
		expect(registered.commands({ space_id: SPACE, intent: 'off' })).toEqual([]);
	});

	it('takes the fields each intent needs', async () => {
		expect(await card().validateConfig({ space_id: SPACE, intent: 'on' })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'off' })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'set_mode', mode: LightingMode.NIGHT })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'role_on', role: LightingRole.MAIN })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'role_off', role: LightingRole.NIGHT })).toEqual([]);
		expect(
			await card().validateConfig({
				space_id: SPACE,
				intent: 'role_brightness',
				role: LightingRole.TASK,
				brightness: 30,
			}),
		).toEqual([]);
	});

	it('refuses a configuration an intent can not run with', async () => {
		expect(await card().validateConfig({ space_id: SPACE, intent: 'brightness_delta' })).toEqual([
			{
				field: 'intent',
				reason: 'The lighting intent must be one of on, off, set_mode, role_on, role_off, role_brightness.',
			},
		]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'set_mode' })).toEqual([
			{ field: 'mode', reason: 'The lighting mode must be one of off, work, relax, night.' },
		]);
		expect(await card().validateConfig({ space_id: SPACE, intent: 'role_on', role: LightingRole.HIDDEN })).toEqual([
			{ field: 'role', reason: 'The lighting role must be one of main, task, ambient, accent, night, other.' },
		]);
		expect(
			await card().validateConfig({
				space_id: SPACE,
				intent: 'role_brightness',
				role: LightingRole.MAIN,
				brightness: 101,
			}),
		).toEqual([{ field: 'brightness', reason: 'The brightness must be a whole number from 0 to 100.' }]);
		expect(await card().validateConfig({ intent: 'off' })).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
	});

	it('refuses a field the intent does not use instead of ignoring it', async () => {
		expect(
			await card().validateConfig({ space_id: SPACE, intent: 'off', mode: LightingMode.WORK, role: LightingRole.MAIN }),
		).toEqual([
			{ field: 'mode', reason: '"mode" does not apply to the off intent.' },
			{ field: 'role', reason: '"role" does not apply to the off intent.' },
		]);
		expect(
			await card().validateConfig({ space_id: SPACE, intent: 'role_on', role: LightingRole.MAIN, brightness: 40 }),
		).toEqual([{ field: 'brightness', reason: '"brightness" does not apply to the role_on intent.' }]);
	});

	it('sends the intent to the space with the automation as its origin', async () => {
		expect(
			await card().execute(
				{ space_id: SPACE, intent: LightingIntentType.ROLE_BRIGHTNESS, role: LightingRole.MAIN, brightness: 30 },
				runContext(),
			),
		).toEqual({ success: true });

		const [spaceId, intent, context] = executeLightingIntent.mock.calls[0];

		expect(spaceId).toBe(SPACE);
		expect(intent).toBeInstanceOf(LightingIntentDto);
		expect({ ...intent }).toEqual({
			type: LightingIntentType.ROLE_BRIGHTNESS,
			role: LightingRole.MAIN,
			brightness: 30,
		});
		expect(context).toEqual({ origin: INTENT_ORIGIN_AUTOMATION, extra: { automationId: 'automation-1' } });
	});

	it('sends a lighting mode', async () => {
		await card().execute(
			{ space_id: SPACE, intent: LightingIntentType.SET_MODE, mode: LightingMode.NIGHT },
			runContext(),
		);

		expect({ ...executeLightingIntent.mock.calls[0][1] }).toEqual({
			type: LightingIntentType.SET_MODE,
			mode: LightingMode.NIGHT,
		});
	});

	it('takes done for a space without lights', async () => {
		executeLightingIntent.mockResolvedValue({ success: true, affectedDevices: 0, failedDevices: 0 });

		expect(await card().execute({ space_id: SPACE, intent: LightingIntentType.OFF }, runContext())).toEqual({
			success: true,
		});
	});

	it('takes the error output when a light failed or was offline', async () => {
		executeLightingIntent.mockResolvedValue({
			success: true,
			affectedDevices: 1,
			failedDevices: 1,
			skippedOfflineDevices: 2,
		});

		expect(await card().execute({ space_id: SPACE, intent: LightingIntentType.OFF }, runContext())).toEqual({
			success: false,
			reason: 'The lighting changed on 1 light(s); 1 failed and 2 were offline.',
		});
	});

	it('takes the error output for a space that does not exist or an intent that throws', async () => {
		executeLightingIntent.mockResolvedValueOnce(null);

		expect(await card().execute({ space_id: SPACE, intent: LightingIntentType.ON }, runContext())).toEqual({
			success: false,
			reason: 'The lighting was not changed: the space does not exist.',
		});

		executeLightingIntent.mockRejectedValueOnce(new Error('Database is locked'));

		expect(await card().execute({ space_id: SPACE, intent: LightingIntentType.ON }, runContext())).toEqual({
			success: false,
			reason: 'The lighting was not changed: Database is locked',
		});
	});

	it('does not change the lighting for a run that was cancelled before it got here', async () => {
		expect(
			await card().execute({ space_id: SPACE, intent: LightingIntentType.ON }, runContext({ signal: abortedSignal() })),
		).toMatchObject({ success: false });
		expect(executeLightingIntent).not.toHaveBeenCalled();
	});
});
