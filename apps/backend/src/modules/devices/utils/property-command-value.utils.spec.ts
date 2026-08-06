import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { validatePropertyCommandValue } from './property-command-value.utils';

const property = (overrides: Partial<ChannelPropertyEntity>): ChannelPropertyEntity =>
	({
		dataType: DataTypeType.BOOL,
		format: null,
		invalid: null,
		step: null,
		...overrides,
	}) as ChannelPropertyEntity;

describe('validatePropertyCommandValue', () => {
	it('normalizes safe boolean and numeric string values', () => {
		expect(validatePropertyCommandValue(property({}), 'true')).toEqual({ valid: true, value: true });
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.INT }), '42')).toEqual({
			valid: true,
			value: 42,
		});
	});

	it('rejects objects and non-finite numeric values', () => {
		expect(validatePropertyCommandValue(property({}), { value: true })).toEqual({
			valid: false,
			reason: 'Value must be a boolean',
		});
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.FLOAT }), Number.POSITIVE_INFINITY)).toEqual({
			valid: false,
			reason: 'Value must be a finite number',
		});
	});

	it('rejects empty string and enum values', () => {
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.STRING }), '')).toEqual({
			valid: false,
			reason: 'Value must not be empty',
		});
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.ENUM }), '')).toEqual({
			valid: false,
			reason: 'Value must not be empty',
		});
	});

	it('enforces enum membership', () => {
		const enumProperty = property({ dataType: DataTypeType.ENUM, format: ['on', 'off'] });

		expect(validatePropertyCommandValue(enumProperty, 'on')).toEqual({ valid: true, value: 'on' });
		expect(validatePropertyCommandValue(enumProperty, 'auto')).toEqual({
			valid: false,
			reason: 'Value must be one of: on, off',
		});
	});

	it('enforces numeric format, integer range, and step constraints', () => {
		const percentage = property({ dataType: DataTypeType.UCHAR, format: [0, 100], step: 5 });

		expect(validatePropertyCommandValue(percentage, 95)).toEqual({ valid: true, value: 95 });
		expect(validatePropertyCommandValue(percentage, 101)).toEqual({
			valid: false,
			reason: 'Value must be less than or equal to 100',
		});
		expect(validatePropertyCommandValue(percentage, 42)).toEqual({
			valid: false,
			reason: 'Value must align to step 5 from base 0',
		});
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.UCHAR }), -1)).toEqual({
			valid: false,
			reason: 'Value must be between 0 and 255',
		});
	});

	it('rejects fractional values for integer data types and sentinel values', () => {
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.INT }), 1.5)).toEqual({
			valid: false,
			reason: 'Value must be an integer',
		});
		expect(validatePropertyCommandValue(property({ invalid: false }), false)).toEqual({
			valid: false,
			reason: 'Value is reserved as an invalid/sentinel value',
		});
		expect(validatePropertyCommandValue(property({ dataType: DataTypeType.INT, invalid: '-1' }), -1)).toEqual({
			valid: false,
			reason: 'Value is reserved as an invalid/sentinel value',
		});
	});
});
