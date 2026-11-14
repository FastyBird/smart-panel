import { describe, expect, it } from 'vitest';

import { AutomationBuiltInNodeType } from './nodes.constants';
import {
	AUTOMATION_BUILT_IN_CONFIG_SCHEMAS,
	AutomationTargetConfigSchema,
	DelayConfigSchema,
	DeviceButtonPressedConfigSchema,
	DeviceConnectionChangedConfigSchema,
	DevicePropertyChangedConfigSchema,
	DevicePropertyCompareConfigSchema,
	DevicePropertySetConfigSchema,
	HouseModeChangedConfigSchema,
	HouseModeIsConfigSchema,
	HouseModeSetConfigSchema,
	JoinConfigSchema,
	ManualStartConfigSchema,
	NotificationSendConfigSchema,
	SceneRunConfigSchema,
	SceneWasRunConfigSchema,
	SecurityArmConfigSchema,
	SecurityArmedIsConfigSchema,
	SecurityStateChangedConfigSchema,
	SunDaylightConfigSchema,
	SunEventConfigSchema,
	TimeOfDayConfigSchema,
	TimeWindowConfigSchema,
	WaitUntilConfigSchema,
	checkNodeConfig,
	defineNodeConfigSchema,
	isValidationKey,
} from './nodes.schemas';

const DEVICE = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a01';
const CHANNEL = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a02';
const PROPERTY = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a03';
const OTHER_PROPERTY = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a04';
const SCENE = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a05';
const AUTOMATION = '6f1a0e1c-7d4b-4c55-9f3e-3b6c2c1b0a06';

const target = { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY };

const key = (name: string): string => `automations.editor.validation.${name}`;

describe('automation card schemas', (): void => {
	it('has a schema for every built-in card', (): void => {
		expect(Object.keys(AUTOMATION_BUILT_IN_CONFIG_SCHEMAS).sort()).toEqual(Object.values(AutomationBuiltInNodeType).sort());
	});

	describe('device value changes', (): void => {
		it.each([
			['any change', {}],
			['a value it becomes', { to: true }],
			['a change from a value to another', { from: 'closed', to: 'open' }],
			['a threshold with a hysteresis and a duration', { above: 25, hysteresis: 0.5, for_seconds: 300 }],
			['a value it becomes, held for a while', { to: 'detected', for_seconds: 60 }],
		])('accepts %s', (_name, operands): void => {
			expect(DevicePropertyChangedConfigSchema.safeParse({ ...target, ...operands }).success).toBe(true);
		});

		it('needs the device, the channel and the property', (): void => {
			expect(DevicePropertyChangedConfigSchema.safeParse({ to: true }).success).toBe(false);
			expect(DevicePropertyChangedConfigSchema.safeParse({ ...target, property_id: 'not-an-id' }).success).toBe(false);
		});

		it('refuses the combinations the backend refuses', (): void => {
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, above: 1, below: 2 })).toEqual({ below: [key('aboveAndBelow')] });
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, above: 1, to: 2 })).toEqual({ to: [key('thresholdAndValue')] });
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, hysteresis: 1 })).toEqual({
				hysteresis: [key('hysteresisNeedsThreshold')],
			});
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, from: 'a', to: 'b', for_seconds: 10 })).toEqual({
				for_seconds: [key('forNeedsState')],
			});
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, for_seconds: 10 })).toEqual({ for_seconds: [key('forNeedsState')] });
		});

		it('limits a duration to whole seconds within 7 days', (): void => {
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, to: 1, for_seconds: 1.5 })).toEqual({ for_seconds: [key('duration')] });
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, to: 1, for_seconds: 7 * 24 * 3600 + 1 })).toEqual({
				for_seconds: [key('forMax')],
			});
		});

		it('refuses a key the card does not know', (): void => {
			expect(checkNodeConfig(DevicePropertyChangedConfigSchema, { ...target, mode: 'any' })).toEqual({ mode: [key('unknownField')] });
		});
	});

	describe('device value is', (): void => {
		it.each([
			['an equality', { operator: 'eq', value: 'on' }],
			['an ordering', { operator: 'gte', value: 21.5 }],
			['a range', { operator: 'between', min: 18, max: 24 }],
			['a list', { operator: 'in', values: ['heat', 'auto'] }],
		])('accepts %s', (_name, operands): void => {
			expect(DevicePropertyCompareConfigSchema.safeParse({ ...target, ...operands }).success).toBe(true);
		});

		it('needs a known operator', (): void => {
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'like', value: 1 })).toEqual({ operator: [key('operator')] });
		});

		it('refuses an operand of another operator, which would mislead', (): void => {
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'eq', value: 1, min: 0 })).toEqual({
				min: [key('notUsedByOperator')],
			});
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'in', values: [1], value: 1 })).toEqual({
				value: [key('notUsedByOperator')],
			});
		});

		it('orders numbers only and wants a range the right way round', (): void => {
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'gt', value: 'warm' })).toEqual({
				value: [key('orderNeedsNumber')],
			});
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'between', min: 30, max: 20 })).toEqual({
				max: [key('maxBelowMin')],
			});
		});

		it('says what is missing only once it is parsed in full, not while the form is filled in', (): void => {
			const config = { ...target, operator: 'eq' };

			expect(DevicePropertyCompareConfigSchema.safeParse(config).success).toBe(false);
			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, config)).toEqual({});
		});

		it('takes at most 50 values', (): void => {
			const values = Array.from({ length: 51 }, (_, index) => index);

			expect(checkNodeConfig(DevicePropertyCompareConfigSchema, { ...target, operator: 'in', values })).toEqual({ values: [key('valuesMax')] });
		});
	});

	describe('set device value', (): void => {
		it('accepts up to 20 values', (): void => {
			expect(DevicePropertySetConfigSchema.safeParse({ writes: [{ ...target, value: true }] }).success).toBe(true);

			const writes = Array.from({ length: 21 }, () => ({ ...target, value: 1 }));

			expect(checkNodeConfig(DevicePropertySetConfigSchema, { writes })).toMatchObject({ writes: [key('writesMax')] });
		});

		it('needs a value for every write', (): void => {
			expect(DevicePropertySetConfigSchema.safeParse({ writes: [{ ...target }] }).success).toBe(false);
		});

		it('refuses the same property set twice, on the second write', (): void => {
			const writes = [
				{ ...target, value: true },
				{ ...target, property_id: OTHER_PROPERTY, value: 1 },
				{ ...target, value: false },
			];

			expect(checkNodeConfig(DevicePropertySetConfigSchema, { writes })).toEqual({ 'writes.2.property_id': [key('propertyTwice')] });
		});

		it('refuses a key a write does not know', (): void => {
			expect(checkNodeConfig(DevicePropertySetConfigSchema, { writes: [{ ...target, value: 1, delay: 5 }] })).toEqual({
				'writes.0.delay': [key('unknownField')],
			});
		});
	});

	describe('time cards', (): void => {
		it('take a time of day as HH:mm and weekdays from 0 (Sunday) to 6', (): void => {
			expect(TimeOfDayConfigSchema.safeParse({ time: '07:30', weekdays: [1, 2, 3, 4, 5] }).success).toBe(true);
			expect(checkNodeConfig(TimeOfDayConfigSchema, { time: '7:30' })).toEqual({ time: [key('time')] });
			expect(checkNodeConfig(TimeOfDayConfigSchema, { time: '24:00' })).toEqual({ time: [key('time')] });
			expect(checkNodeConfig(TimeOfDayConfigSchema, { time: '07:30', weekdays: [7] })).toEqual({ 'weekdays.0': [key('weekday')] });
			expect(checkNodeConfig(TimeOfDayConfigSchema, { time: '07:30', weekdays: [1, 1] })).toEqual({ weekdays: [key('weekdaysTwice')] });
		});

		it('take a window that crosses midnight, but not an empty one', (): void => {
			expect(TimeWindowConfigSchema.safeParse({ from: '22:00', to: '06:00' }).success).toBe(true);
			expect(checkNodeConfig(TimeWindowConfigSchema, { from: '22:00', to: '22:00' })).toEqual({ to: [key('windowEmpty')] });
		});
	});

	describe('the other cards', (): void => {
		it('manual start takes nothing', (): void => {
			expect(ManualStartConfigSchema.safeParse({}).success).toBe(true);
			expect(checkNodeConfig(ManualStartConfigSchema, { reason: 'x' })).toEqual({ reason: [key('unknownField')] });
		});

		it('run scene needs a scene', (): void => {
			expect(SceneRunConfigSchema.safeParse({ scene_id: SCENE }).success).toBe(true);
			expect(checkNodeConfig(SceneRunConfigSchema, { scene_id: 'living-room' })).toEqual({ scene_id: [key('scene')] });
		});

		it('send notification takes a severity, a title and a message within their limits', (): void => {
			expect(NotificationSendConfigSchema.safeParse({ severity: 'warning', title: 'Door open' }).success).toBe(true);
			expect(checkNodeConfig(NotificationSendConfigSchema, { severity: 'loud', title: 'x' })).toEqual({ severity: [key('severity')] });
			expect(checkNodeConfig(NotificationSendConfigSchema, { severity: 'info', title: 'x'.repeat(121) })).toEqual({ title: [key('titleMax')] });
			expect(checkNodeConfig(NotificationSendConfigSchema, { severity: 'info', title: 'x', message: 'x'.repeat(1001) })).toEqual({
				message: [key('messageMax')],
			});
		});

		it('delay waits whole seconds, at most an hour', (): void => {
			expect(DelayConfigSchema.safeParse({ seconds: 3600 }).success).toBe(true);
			expect(checkNodeConfig(DelayConfigSchema, { seconds: 0 })).toEqual({ seconds: [key('durationMin')] });
			expect(checkNodeConfig(DelayConfigSchema, { seconds: 3601 })).toEqual({ seconds: [key('delayMax')] });
		});
	});

	describe('flow', (): void => {
		it('a join takes nothing', (): void => {
			expect(JoinConfigSchema.safeParse({}).success).toBe(true);
			expect(checkNodeConfig(JoinConfigSchema, { count: 2 })).toEqual({ count: [key('unknownField')] });
		});

		it.each([
			['a value it becomes', { to: 'open' }],
			['a threshold above', { above: 20 }],
			['a threshold below', { below: 5 }],
		])('wait until takes %s with a timeout', (_name, operands): void => {
			expect(WaitUntilConfigSchema.safeParse({ ...target, ...operands, timeout_seconds: 600 }).success).toBe(true);
		});

		it('wait until refuses what the state tracker refuses, and a timeout over an hour', (): void => {
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, above: 1, below: 2, timeout_seconds: 60 })).toEqual({
				below: [key('aboveAndBelow')],
			});
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, above: 1, to: 2, timeout_seconds: 60 })).toEqual({ to: [key('thresholdAndValue')] });
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, to: true, timeout_seconds: 3601 })).toEqual({
				timeout_seconds: [key('timeoutMax')],
			});
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, to: true, timeout_seconds: 0 })).toEqual({ timeout_seconds: [key('durationMin')] });
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, to: true, timeout_seconds: 60, from: true })).toEqual({
				from: [key('unknownField')],
			});
			// A state to wait for is needed, as the backend requires it; missing is unfinished rather than wrong
			expect(WaitUntilConfigSchema.safeParse({ ...target, timeout_seconds: 60 }).success).toBe(false);
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, timeout_seconds: 60 })).toEqual({});
			// A timeout is needed, as the backend requires it, but missing is unfinished rather than wrong
			expect(WaitUntilConfigSchema.safeParse({ ...target, to: true }).success).toBe(false);
			expect(checkNodeConfig(WaitUntilConfigSchema, { ...target, to: true })).toEqual({});
		});
	});

	describe('sun', (): void => {
		it('sunrise or sunset takes an offset of at most six hours either way', (): void => {
			expect(SunEventConfigSchema.safeParse({ event: 'sunrise' }).success).toBe(true);
			expect(SunEventConfigSchema.safeParse({ event: 'sunset', offset_minutes: -360 }).success).toBe(true);
			expect(SunEventConfigSchema.safeParse({ event: 'sunset', offset_minutes: 360 }).success).toBe(true);
			expect(checkNodeConfig(SunEventConfigSchema, { event: 'sunset', offset_minutes: 361 })).toEqual({ offset_minutes: [key('offset')] });
			expect(checkNodeConfig(SunEventConfigSchema, { event: 'sunset', offset_minutes: -361 })).toEqual({ offset_minutes: [key('offset')] });
			expect(checkNodeConfig(SunEventConfigSchema, { event: 'sunset', offset_minutes: 1.5 })).toEqual({ offset_minutes: [key('offset')] });
			expect(checkNodeConfig(SunEventConfigSchema, { event: 'noon' })).toEqual({ event: [key('sunEvent')] });
		});

		it('day or night takes one of them', (): void => {
			expect(SunDaylightConfigSchema.safeParse({ state: 'night' }).success).toBe(true);
			expect(checkNodeConfig(SunDaylightConfigSchema, { state: 'dusk' })).toEqual({ state: [key('daylight')] });
		});
	});

	describe('devices and scenes', (): void => {
		it('a button takes every press, or a list of different presses', (): void => {
			expect(DeviceButtonPressedConfigSchema.safeParse(target).success).toBe(true);
			expect(DeviceButtonPressedConfigSchema.safeParse({ ...target, events: ['press', 'long_press'] }).success).toBe(true);
			expect(checkNodeConfig(DeviceButtonPressedConfigSchema, { ...target, events: [] })).toEqual({ events: [key('buttonEvents')] });
			expect(checkNodeConfig(DeviceButtonPressedConfigSchema, { ...target, events: ['press', 'press'] })).toEqual({ events: [key('listTwice')] });
			expect(checkNodeConfig(DeviceButtonPressedConfigSchema, { ...target, events: [''] })).toEqual({ 'events.0': [key('buttonEvent')] });
			expect(checkNodeConfig(DeviceButtonPressedConfigSchema, { ...target, events: ['x'.repeat(65)] })).toEqual({
				'events.0': [key('buttonEvent')],
			});
			expect(
				checkNodeConfig(DeviceButtonPressedConfigSchema, { ...target, events: Array.from({ length: 21 }, (_item, index) => `p${index}`) })
			).toEqual({ events: [key('buttonEventsMax')] });
		});

		it('a connection trigger needs a device, and goes either way unless told', (): void => {
			expect(DeviceConnectionChangedConfigSchema.safeParse({ device_id: DEVICE }).success).toBe(true);
			expect(DeviceConnectionChangedConfigSchema.safeParse({ device_id: DEVICE, to: 'offline' }).success).toBe(true);
			expect(checkNodeConfig(DeviceConnectionChangedConfigSchema, { device_id: DEVICE, to: 'away' })).toEqual({ to: [key('connection')] });
			expect(checkNodeConfig(DeviceConnectionChangedConfigSchema, { device_id: DEVICE, channel_id: CHANNEL })).toEqual({
				channel_id: [key('unknownField')],
			});
		});

		it('scene was run needs a scene', (): void => {
			expect(SceneWasRunConfigSchema.safeParse({ scene_id: SCENE }).success).toBe(true);
			expect(checkNodeConfig(SceneWasRunConfigSchema, { scene_id: 'evening' })).toEqual({ scene_id: [key('scene')] });
		});
	});

	describe('house mode', (): void => {
		it('changes from one mode to another, never to the same', (): void => {
			expect(HouseModeChangedConfigSchema.safeParse({}).success).toBe(true);
			expect(HouseModeChangedConfigSchema.safeParse({ from: 'home', to: 'away' }).success).toBe(true);
			expect(checkNodeConfig(HouseModeChangedConfigSchema, { from: 'away', to: 'away' })).toEqual({ to: [key('sameState')] });
			expect(checkNodeConfig(HouseModeChangedConfigSchema, { to: 'party' })).toEqual({ to: [key('houseMode')] });
		});

		it('is one of the modes picked, at least one and each once', (): void => {
			expect(HouseModeIsConfigSchema.safeParse({ modes: ['home', 'night'] }).success).toBe(true);
			expect(checkNodeConfig(HouseModeIsConfigSchema, { modes: [] })).toEqual({ modes: [key('houseModes')] });
			expect(checkNodeConfig(HouseModeIsConfigSchema, { modes: ['home', 'home'] })).toEqual({ modes: [key('listTwice')] });
			expect(checkNodeConfig(HouseModeIsConfigSchema, { modes: ['party'] })).toEqual({ 'modes.0': [key('houseMode')] });
		});

		it('is set to one mode', (): void => {
			expect(HouseModeSetConfigSchema.safeParse({ mode: 'night' }).success).toBe(true);
			expect(checkNodeConfig(HouseModeSetConfigSchema, { mode: 'party' })).toEqual({ mode: [key('houseMode')] });
		});
	});

	describe('security', (): void => {
		it('a state change takes only the states of the state watched', (): void => {
			expect(SecurityStateChangedConfigSchema.safeParse({ kind: 'alarm', to: 'triggered' }).success).toBe(true);
			expect(SecurityStateChangedConfigSchema.safeParse({ kind: 'armed', from: 'disarmed', to: 'armed_away' }).success).toBe(true);
			expect(checkNodeConfig(SecurityStateChangedConfigSchema, { kind: 'armed', to: 'triggered' })).toEqual({ to: [key('securityState')] });
			expect(checkNodeConfig(SecurityStateChangedConfigSchema, { kind: 'alarm', from: 'idle', to: 'idle' })).toEqual({ to: [key('sameState')] });
			expect(checkNodeConfig(SecurityStateChangedConfigSchema, { kind: 'motion' })).toEqual({ kind: [key('securityKind')] });
		});

		it('armed is takes armed states only', (): void => {
			expect(SecurityArmedIsConfigSchema.safeParse({ states: ['armed_away', 'armed_night'] }).success).toBe(true);
			expect(checkNodeConfig(SecurityArmedIsConfigSchema, { states: [] })).toEqual({ states: [key('armedStates')] });
			expect(checkNodeConfig(SecurityArmedIsConfigSchema, { states: ['triggered'] })).toEqual({ 'states.0': [key('armedStates')] });
		});

		it('arm never disarms', (): void => {
			expect(SecurityArmConfigSchema.safeParse({ ...target, armed_state: 'armed_home' }).success).toBe(true);
			expect(checkNodeConfig(SecurityArmConfigSchema, { ...target, armed_state: 'disarmed' })).toEqual({ armed_state: [key('armState')] });
		});
	});

	it('the automation actions need another automation', (): void => {
		expect(AutomationTargetConfigSchema.safeParse({ automation_id: AUTOMATION }).success).toBe(true);
		expect(checkNodeConfig(AutomationTargetConfigSchema, { automation_id: 'morning' })).toEqual({ automation_id: [key('automation')] });
	});

	it('words the rules of a schema a plugin defines with the keys of the plugin', (): void => {
		const schema = defineNodeConfigSchema(
			{},
			(config, report): void => {
				if (config.a === config.b) report(['b'], 'same');
			},
			'plugin.validation.'
		);

		expect(checkNodeConfig(schema, { a: 1, b: 1 })).toEqual({ a: [key('unknownField')], b: [key('unknownField'), 'plugin.validation.same'] });
	});

	it('tells its own messages from those of a schema a plugin brought', (): void => {
		expect(isValidationKey(key('time'))).toBe(true);
		expect(isValidationKey('Too long')).toBe(false);
	});
});
