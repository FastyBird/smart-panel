import { describe, expect, it } from 'vitest';

import { describeConfigSchema, issueFieldKey, normalizeListValue, setConfigValue } from './automations.config-schema';

describe('automations.config-schema', (): void => {
	describe('describeConfigSchema', (): void => {
		it('reads the schema of the "device value changes" card', (): void => {
			const form = describeConfigSchema({
				type: 'object',
				properties: {
					device_id: { type: 'string', format: 'uuid', description: 'The device the property belongs to.' },
					to: { type: ['string', 'number', 'boolean'], description: 'Start when the value becomes this.' },
					above: { type: 'number' },
					hysteresis: { type: 'number', minimum: 0 },
					for_seconds: { type: 'integer', minimum: 1, maximum: 86400 },
				},
				required: ['device_id'],
				additionalProperties: false,
			});

			expect(form.free).toBe(false);
			expect(form.empty).toBe(false);
			expect(form.fields.map((field) => [field.key, field.control, field.required])).toEqual([
				['device_id', 'text', true],
				['to', 'value', false],
				['above', 'number', false],
				['hysteresis', 'number', false],
				['for_seconds', 'number', false],
			]);
			expect(form.fields[0]).toMatchObject({ label: 'Device id', description: 'The device the property belongs to.' });
			expect(form.fields[3]).toMatchObject({ integer: false, min: 0, max: undefined });
			expect(form.fields[4]).toMatchObject({ label: 'For seconds', integer: true, min: 1, max: 86400 });
		});

		it('offers the values of an enum and of a small range of whole numbers', (): void => {
			const form = describeConfigSchema({
				type: 'object',
				properties: {
					operator: { type: 'string', enum: ['eq', 'lt'] },
					weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, uniqueItems: true },
					tags: { type: 'array', items: { type: 'string' } },
					levels: { type: 'array', items: { type: 'number' } },
					sizes: { type: 'array', items: { type: 'string', enum: ['s', 'm'] } },
					years: { type: 'array', items: { type: 'integer', minimum: 1900, maximum: 2100 } },
				},
			});

			expect(form.fields.map((field) => [field.key, field.control, field.options, field.numeric])).toEqual([
				['operator', 'select', ['eq', 'lt'], false],
				['weekdays', 'list', [0, 1, 2, 3, 4, 5, 6], true],
				['tags', 'list', undefined, false],
				['levels', 'list', undefined, true],
				['sizes', 'list', ['s', 'm'], false],
				['years', 'list', undefined, true],
			]);
		});

		it('edits as JSON whatever it does not understand', (): void => {
			const form = describeConfigSchema({
				type: 'object',
				properties: {
					writes: { type: 'array', items: { type: 'object', properties: { value: { type: 'boolean' } } } },
					nested: { type: 'object' },
					anything: {},
					either: { type: ['string', 'object'] },
					flag: { type: 'boolean' },
				},
				required: ['writes'],
			});

			expect(form.fields.map((field) => [field.key, field.control])).toEqual([
				['writes', 'json'],
				['nested', 'json'],
				['anything', 'json'],
				['either', 'json'],
				['flag', 'boolean'],
			]);
		});

		it('uses the title of a property when it has one', (): void => {
			expect(describeConfigSchema({ properties: { message_text: { type: 'string', title: 'Message' } } }).fields[0]?.label).toBe('Message');
		});

		it('tells a card with nothing to configure from one that does not describe its configuration', (): void => {
			expect(describeConfigSchema({ type: 'object', properties: {}, additionalProperties: false })).toEqual({ fields: [], free: false, empty: true });
			expect(describeConfigSchema({ type: 'object', additionalProperties: true })).toEqual({ fields: [], free: true, empty: false });
			expect(describeConfigSchema({})).toEqual({ fields: [], free: true, empty: false });
		});

		it('does not fail on a schema that is not one', (): void => {
			expect(describeConfigSchema({ properties: 'nope', required: 'nope' })).toEqual({ fields: [], free: true, empty: false });
			expect(describeConfigSchema({ properties: { a: null, b: 'x', c: { type: 5 } } }).fields.map((field) => [field.key, field.control])).toEqual([
				['c', 'json'],
			]);
		});
	});

	describe('setConfigValue', (): void => {
		it('sets a value without touching the configuration it was given', (): void => {
			const config = { a: 1 };

			expect(setConfigValue(config, 'b', 'x')).toEqual({ a: 1, b: 'x' });
			expect(config).toEqual({ a: 1 });
		});

		it('keeps the place of a key that is changed', (): void => {
			expect(Object.keys(setConfigValue({ a: 1, b: 2, c: 3 }, 'b', 5))).toEqual(['a', 'b', 'c']);
		});

		it('leaves a cleared value out instead of storing it empty', (): void => {
			const config = { a: 1, b: 'x' };

			for (const cleared of [null, undefined, [], Number.NaN]) {
				expect(setConfigValue(config, 'b', cleared)).toEqual({ a: 1 });
			}
		});

		it('keeps false, zero and empty text, which are values', (): void => {
			expect(setConfigValue({}, 'on', false)).toEqual({ on: false });
			expect(setConfigValue({}, 'level', 0)).toEqual({ level: 0 });
			// A device property may hold empty text, so a comparison or a `to` filter can be about it
			expect(setConfigValue({ to: 'on' }, 'to', '')).toEqual({ to: '' });
		});
	});

	describe('normalizeListValue', (): void => {
		it('turns what was typed into numbers for a list of numbers', (): void => {
			expect(normalizeListValue({ numeric: true, integer: true }, ['1', 2, '2', 'x', '', '1.5', 3])).toEqual([1, 2, 3]);
			expect(normalizeListValue({ numeric: true, integer: false }, ['1.5', 2])).toEqual([1.5, 2]);
		});

		it('keeps text as it is and drops repeats', (): void => {
			expect(normalizeListValue({ numeric: false, integer: false }, ['a', 'b', 'a', null, {}])).toEqual(['a', 'b']);
		});
	});

	describe('issueFieldKey', (): void => {
		it('takes the first part of the path of an issue', (): void => {
			expect(issueFieldKey('writes.0.value')).toBe('writes');
			expect(issueFieldKey('seconds')).toBe('seconds');
			expect(issueFieldKey(undefined)).toBeNull();
			expect(issueFieldKey('')).toBeNull();
		});
	});
});
