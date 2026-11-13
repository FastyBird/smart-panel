import { ChannelCategory, DataTypeType, PermissionType, PropertyCategory } from '../../devices/devices.constants';
import { ArmedState } from '../../security/security.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { classifySafetyReducingWrite } from '../safety/safety-rules';
import { CHANNEL_A, CHANNEL_B, DEVICE_A, abortedSignal, runContext, target } from '../testing/node-fixtures';

import { DevicePropertyCommandsResult } from './device-property-set.node-type';
import { DevicePropertyInfo } from './device-property.utils';
import { SECURITY_ARM_NODE_TYPE, createSecurityArmNodeType } from './security-arm.node-type';

const ALARM_STATE = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000a1';
const READ_ONLY_STATE = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000a2';
const SIREN = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000a3';
const NARROW_STATE = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000a4';

const alarmProperty = (id: string, overrides: Partial<DevicePropertyInfo> = {}): DevicePropertyInfo => ({
	id,
	channelId: CHANNEL_A,
	deviceId: DEVICE_A,
	dataType: DataTypeType.ENUM,
	format: ['disarmed', 'armed_home', 'armed_away', 'armed_night'],
	invalid: null,
	step: null,
	permissions: [PermissionType.READ_WRITE],
	category: PropertyCategory.STATE,
	channelCategory: ChannelCategory.ALARM,
	...overrides,
});

const PROPERTIES: DevicePropertyInfo[] = [
	alarmProperty(ALARM_STATE),
	alarmProperty(READ_ONLY_STATE, { permissions: [PermissionType.READ_ONLY] }),
	alarmProperty(SIREN, { category: PropertyCategory.ON, dataType: DataTypeType.BOOL, format: null }),
	// An alarm that has no night mode
	alarmProperty(NARROW_STATE, { format: ['disarmed', 'armed_away'] }),
];

describe('security.arm', () => {
	let executePropertyCommands: jest.Mock<Promise<DevicePropertyCommandsResult>>;

	const card = () =>
		createSecurityArmNodeType({
			commands: { executePropertyCommands },
			findProperty: (id) => Promise.resolve(PROPERTIES.find((item) => item.id === id) ?? null),
		});

	beforeEach(() => {
		executePropertyCommands = jest.fn<Promise<DevicePropertyCommandsResult>, []>(() =>
			Promise.resolve({ success: true, results: [{ success: true }] }),
		);
	});

	it('is an action that refers to the alarm and declares the write, so the safety policy judges it', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SECURITY_ARM_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
		});
		expect(registered.references({ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_AWAY })).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: ALARM_STATE },
		]);
		expect(registered.commands({ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_AWAY })).toEqual([
			{ kind: 'property_write', propertyId: ALARM_STATE, value: ArmedState.ARMED_AWAY, field: 'armed_state' },
		]);
		expect(registered.commands({})).toEqual([]);
	});

	it('arms to home, away or night, and never disarms', async () => {
		for (const state of [ArmedState.ARMED_HOME, ArmedState.ARMED_AWAY, ArmedState.ARMED_NIGHT]) {
			expect(await card().validateConfig({ ...target(ALARM_STATE), armed_state: state })).toEqual([]);
		}

		expect(await card().validateConfig({ ...target(ALARM_STATE), armed_state: ArmedState.DISARMED })).toEqual([
			{ field: 'armed_state', reason: 'The alarm can be armed to armed_home, armed_away, armed_night.' },
		]);
	});

	it('writes only states the safety policy lets an automation write', () => {
		const alarm = {
			deviceCategory: ChannelCategory.ALARM as string,
			channelCategory: ChannelCategory.ALARM as string,
			propertyCategory: PropertyCategory.STATE as string,
		};

		for (const state of [ArmedState.ARMED_HOME, ArmedState.ARMED_AWAY, ArmedState.ARMED_NIGHT]) {
			expect(classifySafetyReducingWrite(alarm, state)).toBeNull();
		}

		expect(classifySafetyReducingWrite(alarm, ArmedState.DISARMED)).toMatchObject({ kind: 'disarm' });
	});

	it('refuses a property that is not the armed state of an alarm, or that can not be set', async () => {
		expect(await card().validateConfig({ ...target(SIREN), armed_state: ArmedState.ARMED_AWAY })).toEqual([
			{ field: 'property_id', reason: 'This property is not the armed state of an alarm.' },
		]);
		expect(await card().validateConfig({ ...target(READ_ONLY_STATE), armed_state: ArmedState.ARMED_AWAY })).toEqual([
			{ field: 'property_id', reason: 'This property can not be set.' },
		]);
		expect(
			await card().validateConfig({ ...target(ALARM_STATE, DEVICE_A, CHANNEL_B), armed_state: ArmedState.ARMED_AWAY }),
		).toEqual([{ field: 'channel_id', reason: 'The property does not belong to this channel.' }]);
	});

	it('refuses an armed state the alarm does not know', async () => {
		expect(await card().validateConfig({ ...target(NARROW_STATE), armed_state: ArmedState.ARMED_NIGHT })).toEqual([
			{ field: 'armed_state', reason: 'This value is not one the property can hold.' },
		]);
	});

	it('writes the armed state with the automation as the origin of the intent', async () => {
		expect(await card().execute({ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_AWAY }, runContext())).toEqual({
			success: true,
		});
		expect(executePropertyCommands).toHaveBeenCalledWith(
			[
				{
					propertyId: ALARM_STATE,
					value: ArmedState.ARMED_AWAY,
					requestedDeviceId: DEVICE_A,
					requestedChannelId: CHANNEL_A,
				},
			],
			{ context: { origin: 'automation', extra: { automationId: 'automation-1' } } },
		);
	});

	it('takes the error output when the alarm refuses the state or the command fails', async () => {
		executePropertyCommands.mockResolvedValueOnce({
			success: false,
			results: [{ success: false, reason: 'Device is offline' }],
		});

		expect(await card().execute({ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_HOME }, runContext())).toEqual({
			success: false,
			reason: 'Device is offline',
		});

		executePropertyCommands.mockRejectedValueOnce(new Error('Property was not found'));

		expect(await card().execute({ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_HOME }, runContext())).toEqual({
			success: false,
			reason: 'Property was not found',
		});
	});

	it('does not arm for a run that was cancelled before it got here', async () => {
		expect(
			await card().execute(
				{ ...target(ALARM_STATE), armed_state: ArmedState.ARMED_AWAY },
				runContext({ signal: abortedSignal() }),
			),
		).toMatchObject({ success: false });
		expect(executePropertyCommands).not.toHaveBeenCalled();
	});
});
