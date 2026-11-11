import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';

import {
	SAFETY_REDUCING_RULES,
	SafetyWriteTarget,
	classifySafetyReducingWrite,
	describeSafetyRefusal,
} from './safety-rules';

const target = (
	deviceCategory: string | null,
	channelCategory: string | null,
	propertyCategory: string | null,
): SafetyWriteTarget => ({ deviceCategory, channelCategory, propertyCategory });

const LOCK_STATUS = target(DeviceCategory.LOCK, ChannelCategory.LOCK, PropertyCategory.STATUS);
const LOCK_ON = target(DeviceCategory.LOCK, ChannelCategory.LOCK, PropertyCategory.ON);
const LOCK_LOCKED = target(DeviceCategory.LOCK, ChannelCategory.LOCK, PropertyCategory.LOCKED);
const ALARM_STATE = target(DeviceCategory.ALARM, ChannelCategory.ALARM, PropertyCategory.STATE);
const ALARM_SIREN = target(DeviceCategory.ALARM, ChannelCategory.ALARM, PropertyCategory.SIREN);
const DOOR_POSITION = target(DeviceCategory.DOOR, ChannelCategory.DOOR, PropertyCategory.POSITION);
const DOOR_COMMAND = target(DeviceCategory.DOOR, ChannelCategory.DOOR, PropertyCategory.COMMAND);
const DOOR_PERCENTAGE = target(DeviceCategory.DOOR, ChannelCategory.DOOR, PropertyCategory.PERCENTAGE);

const kindOf = (where: SafetyWriteTarget, value: unknown): string | null =>
	classifySafetyReducingWrite(where, value)?.kind ?? null;

describe('safety rules', () => {
	it('lists unlock, disarm and open, each once', () => {
		expect(SAFETY_REDUCING_RULES.map((rule) => rule.kind)).toEqual(['unlock', 'disarm', 'open']);
	});

	describe('locks', () => {
		it.each([
			['status: unlocked', LOCK_STATUS, 'unlocked'],
			['status in another case', LOCK_STATUS, ' Unlocked '],
			['an unlock command', target(DeviceCategory.LOCK, ChannelCategory.LOCK, PropertyCategory.COMMAND), 'unlock'],
			['on: false', LOCK_ON, false],
			['on: 0', LOCK_ON, 0],
			['on: "false"', LOCK_ON, 'false'],
			['on: "off"', LOCK_ON, 'off'],
			['locked: false', LOCK_LOCKED, false],
		])('refuses %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBe('unlock');
		});

		it.each([
			['status: locked', LOCK_STATUS, 'locked'],
			['on: true', LOCK_ON, true],
			['on: 1', LOCK_ON, 1],
			['locked: true', LOCK_LOCKED, true],
		])('allows locking with %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBeNull();
		});

		it('knows the lock of a door and of a doorbell by its channel', () => {
			expect(kindOf(target(DeviceCategory.DOOR, ChannelCategory.LOCK, PropertyCategory.STATUS), 'unlocked')).toBe(
				'unlock',
			);
			expect(kindOf(target(DeviceCategory.DOORBELL, ChannelCategory.LOCK, PropertyCategory.ON), false)).toBe('unlock');
			expect(kindOf(target(DeviceCategory.DOOR, ChannelCategory.LOCK, PropertyCategory.STATUS), 'locked')).toBeNull();
			expect(kindOf(target(DeviceCategory.DOOR, ChannelCategory.LOCK, PropertyCategory.ON), true)).toBeNull();
		});

		it('knows a lock device whatever channel carries its state', () => {
			expect(kindOf(target(DeviceCategory.LOCK, ChannelCategory.SWITCHER, PropertyCategory.ON), false)).toBe('unlock');
			expect(kindOf(target(DeviceCategory.LOCK, ChannelCategory.GENERIC, PropertyCategory.GENERIC), 'unlocked')).toBe(
				'unlock',
			);
			expect(kindOf(target(DeviceCategory.LOCK, ChannelCategory.SWITCHER, PropertyCategory.ON), true)).toBeNull();
		});
	});

	describe('alarm', () => {
		it.each([
			['state: disarmed', ALARM_STATE, 'disarmed'],
			['state: DISARMED', ALARM_STATE, 'DISARMED'],
			['a disarm command', target(DeviceCategory.ALARM, ChannelCategory.ALARM, PropertyCategory.COMMAND), 'disarm'],
			['state: false', ALARM_STATE, false],
			['on: false', target(DeviceCategory.ALARM, ChannelCategory.ALARM, PropertyCategory.ON), false],
		])('refuses %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBe('disarm');
		});

		it.each([
			['armed_home', ALARM_STATE, 'armed_home'],
			['armed_away', ALARM_STATE, 'armed_away'],
			['armed_night', ALARM_STATE, 'armed_night'],
			['state: true', ALARM_STATE, true],
			['the siren on', ALARM_SIREN, true],
			['the siren off', ALARM_SIREN, false],
		])('allows %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBeNull();
		});
	});

	describe('doors, garages and gates', () => {
		it.each([
			['position: open', DOOR_POSITION, 'open'],
			['command: open', DOOR_COMMAND, 'open'],
			['status: opened', target(DeviceCategory.DOOR, ChannelCategory.DOOR, PropertyCategory.STATUS), 'opened'],
			['a position above zero', DOOR_POSITION, 40],
			['a percentage above zero', DOOR_PERCENTAGE, 1],
			['a percentage given as a text', DOOR_PERCENTAGE, '100'],
		])('refuses %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBe('open');
		});

		it.each([
			['position: close', DOOR_POSITION, 'close'],
			['position: stop', DOOR_POSITION, 'stop'],
			['command: close', DOOR_COMMAND, 'close'],
			['a position of zero', DOOR_POSITION, 0],
			['a percentage of zero', DOOR_PERCENTAGE, 0],
			['a percentage of zero given as a text', DOOR_PERCENTAGE, '0'],
		])('allows %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBeNull();
		});

		it('knows a door channel on any device, a garage door included', () => {
			expect(kindOf(target(DeviceCategory.GENERIC, ChannelCategory.DOOR, PropertyCategory.POSITION), 'open')).toBe(
				'open',
			);
		});

		it('knows a door device whose movement is carried by another channel', () => {
			const covering = target(DeviceCategory.DOOR, ChannelCategory.WINDOW_COVERING, PropertyCategory.COMMAND);

			expect(kindOf(covering, 'open')).toBe('open');
			expect(kindOf(covering, 'close')).toBeNull();
		});
	});

	describe('everything else', () => {
		it.each([
			['a light switched off', target(DeviceCategory.LIGHTING, ChannelCategory.LIGHT, PropertyCategory.ON), false],
			[
				'a blind opened',
				target(DeviceCategory.WINDOW_COVERING, ChannelCategory.WINDOW_COVERING, PropertyCategory.COMMAND),
				'open',
			],
			[
				'a blind moved',
				target(DeviceCategory.WINDOW_COVERING, ChannelCategory.WINDOW_COVERING, PropertyCategory.POSITION),
				80,
			],
			['a valve opened', target(DeviceCategory.VALVE, ChannelCategory.VALVE, PropertyCategory.ON), true],
			[
				'a thermostat set',
				target(DeviceCategory.THERMOSTAT, ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED),
				false,
			],
			[
				'a text that says disarmed',
				target(DeviceCategory.SPEAKER, ChannelCategory.SPEAKER, PropertyCategory.GENERIC),
				'disarmed',
			],
			['nothing known about the target', target(null, null, null), 'unlocked'],
		])('allows %s', (_name, where, value) => {
			expect(kindOf(where, value)).toBeNull();
		});

		it('takes a value it can not read for one that changes nothing', () => {
			expect(kindOf(LOCK_STATUS, null)).toBeNull();
			expect(kindOf(LOCK_STATUS, undefined)).toBeNull();
			expect(kindOf(DOOR_POSITION, { open: true })).toBeNull();
			expect(kindOf(DOOR_PERCENTAGE, Number.NaN)).toBeNull();
			expect(kindOf(DOOR_PERCENTAGE, '')).toBeNull();
		});
	});

	it('explains a refusal without repeating the value', () => {
		expect(describeSafetyRefusal({ kind: 'unlock', action: 'unlock a lock' })).toBe(
			'An automation can not unlock a lock.',
		);
		expect(classifySafetyReducingWrite(ALARM_STATE, 'disarmed')).toEqual({
			kind: 'disarm',
			action: 'disarm the alarm',
		});
		expect(classifySafetyReducingWrite(DOOR_POSITION, 'open')).toEqual({
			kind: 'open',
			action: 'open a door, garage or gate',
		});
	});
});
