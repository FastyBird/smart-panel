import { describe, expect, it } from 'vitest';

import { DevicesModuleChannelPropertyDataType } from '../../../openapi.constants';

import { classifySafetyReducingWrite, isAboveZeroUnsafe } from './nodes.safety';
import {
	changedModeOf,
	changedModesFor,
	compareOperatorsFor,
	enumValuesOf,
	numberRangeOf,
	propertyValueKind,
	valueFitsProperty,
} from './nodes.values';

const of = (dataType: DevicesModuleChannelPropertyDataType, format: (string | number | null)[] | null = null) => ({ dataType, format });

describe('automation card values', (): void => {
	it('reads the kind of value a property holds', (): void => {
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.uchar))).toBe('number');
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.float))).toBe('number');
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.bool))).toBe('boolean');
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.enum))).toBe('enum');
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.string))).toBe('string');
		expect(propertyValueKind(of(DevicesModuleChannelPropertyDataType.unknown))).toBe('unknown');
		expect(propertyValueKind(null)).toBe('unknown');
	});

	it('offers the comparisons that suit the value', (): void => {
		expect(compareOperatorsFor('boolean')).toEqual(['eq', 'neq']);
		expect(compareOperatorsFor('enum')).toEqual(['eq', 'neq', 'in']);
		expect(compareOperatorsFor('number')).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in']);
	});

	it('takes the table of comparisons the backend publishes over its own', (): void => {
		const schema = { 'x-operators-by-value-kind': { boolean: ['eq'], number: ['eq', 'like'] } };

		expect(compareOperatorsFor('boolean', schema)).toEqual(['eq']);
		// A table that names an operator the admin does not know is not trusted
		expect(compareOperatorsFor('number', schema)).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in']);
	});

	it('offers a threshold only for a number', (): void => {
		expect(changedModesFor('number')).toContain('above');
		expect(changedModesFor('unknown')).toContain('below');
		expect(changedModesFor('boolean')).toEqual(['any', 'to', 'from', 'fromTo']);
	});

	it('reads how a value trigger starts from its configuration', (): void => {
		expect(changedModeOf({})).toBe('any');
		expect(changedModeOf({ to: false })).toBe('to');
		expect(changedModeOf({ from: 1 })).toBe('from');
		expect(changedModeOf({ from: 1, to: 2 })).toBe('fromTo');
		expect(changedModeOf({ below: 3, hysteresis: 1 })).toBe('below');
	});

	it('tells whether a value fits a property', (): void => {
		expect(valueFitsProperty(1, of(DevicesModuleChannelPropertyDataType.int))).toBe(true);
		expect(valueFitsProperty('1', of(DevicesModuleChannelPropertyDataType.int))).toBe(false);
		expect(valueFitsProperty('heat', of(DevicesModuleChannelPropertyDataType.enum, ['heat', 'cool']))).toBe(true);
		expect(valueFitsProperty('dry', of(DevicesModuleChannelPropertyDataType.enum, ['heat', 'cool']))).toBe(false);
		expect(valueFitsProperty(true, null)).toBe(true);
		expect(valueFitsProperty(Number.NaN, null)).toBe(false);
	});

	it('reads the values and the range of a property from its format', (): void => {
		expect(enumValuesOf(of(DevicesModuleChannelPropertyDataType.enum, ['a', 'b']))).toEqual(['a', 'b']);
		expect(enumValuesOf(of(DevicesModuleChannelPropertyDataType.int, [0, 100]))).toEqual([]);
		expect(numberRangeOf(of(DevicesModuleChannelPropertyDataType.int, [0, 100]))).toEqual({ min: 0, max: 100 });
		expect(numberRangeOf(of(DevicesModuleChannelPropertyDataType.int, [null, 100]))).toEqual({ max: 100 });
	});
});

describe('automation safety rules', (): void => {
	const lock = { deviceCategory: 'lock', channelCategory: 'lock', propertyCategory: 'locked' };
	const alarm = { deviceCategory: 'alarm', channelCategory: 'alarm', propertyCategory: 'state' };
	const garage = { deviceCategory: 'door', channelCategory: 'door', propertyCategory: 'position' };
	const light = { deviceCategory: 'lighting', channelCategory: 'light', propertyCategory: 'on' };

	it('recognises unlocking, disarming and opening in every known form', (): void => {
		expect(classifySafetyReducingWrite(lock, false)).toBe('unlock');
		expect(classifySafetyReducingWrite({ ...lock, propertyCategory: 'status' }, 'Unlocked')).toBe('unlock');
		expect(classifySafetyReducingWrite(alarm, 'disarmed')).toBe('disarm');
		expect(classifySafetyReducingWrite(alarm, 'off')).toBe('disarm');
		expect(classifySafetyReducingWrite(garage, 30)).toBe('open');
		expect(classifySafetyReducingWrite({ ...garage, propertyCategory: 'command' }, 'open')).toBe('open');
	});

	it('lets an automation lock, arm, close and do anything to what is not a lock, an alarm or a door', (): void => {
		expect(classifySafetyReducingWrite(lock, true)).toBeNull();
		expect(classifySafetyReducingWrite(alarm, 'armed_away')).toBeNull();
		expect(classifySafetyReducingWrite(garage, 0)).toBeNull();
		expect(classifySafetyReducingWrite(light, false)).toBeNull();
		expect(classifySafetyReducingWrite({ deviceCategory: 'valve', channelCategory: 'valve', propertyCategory: 'on' }, 'open')).toBeNull();
	});

	it('holds a rule for every channel of a device of the category', (): void => {
		expect(classifySafetyReducingWrite({ deviceCategory: 'lock', channelCategory: 'switcher', propertyCategory: 'on' }, false)).toBe('unlock');
	});

	it('knows which numbers must stop at zero', (): void => {
		expect(isAboveZeroUnsafe(garage)).toBe(true);
		expect(isAboveZeroUnsafe({ ...garage, propertyCategory: 'percentage' })).toBe(true);
		expect(isAboveZeroUnsafe(lock)).toBe(false);
		expect(isAboveZeroUnsafe({ deviceCategory: 'window_covering', channelCategory: 'window_covering', propertyCategory: 'position' })).toBe(false);
	});
});
