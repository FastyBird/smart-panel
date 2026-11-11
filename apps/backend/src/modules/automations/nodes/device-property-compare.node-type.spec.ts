import { normalizeAutomationNodeType } from '../graph/node-type';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import {
	CHANNEL_A,
	CHANNEL_B,
	DEVICE_A,
	DEVICE_B,
	PROPERTY_BOOL,
	PROPERTY_ENUM,
	PROPERTY_MISSING,
	PROPERTY_NUMBER,
	fixtureFindProperty,
	runContext,
	target,
} from '../testing/node-fixtures';
import { StateSnapshot, StateTracker } from '../tracker/state-tracker';

import {
	COMPARE_OPERATORS,
	COMPARE_OPERATORS_BY_VALUE_KIND,
	DEVICE_PROPERTY_COMPARE_NODE_TYPE,
	DevicePropertyCompareConfigDto,
	createDevicePropertyCompareNodeType,
} from './device-property-compare.node-type';

describe('device.property.compare', () => {
	let tracker: StateTracker;
	let settled: jest.Mock<Promise<void>, []>;

	const card = () =>
		createDevicePropertyCompareNodeType({
			tracker: { read: (propertyId) => tracker.read(propertyId), settled },
			findProperty: fixtureFindProperty,
		});

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	const evaluate = (config: Record<string, unknown>) =>
		card().evaluate(config as unknown as DevicePropertyCompareConfigDto, runContext());

	/** Makes the tracker know a value, the way the engine holds the properties of an armed automation */
	const known = (propertyId: string, snapshot: StateSnapshot): void => {
		tracker.reference(propertyId);
		tracker.seed(propertyId, snapshot);
	};

	beforeEach(() => {
		tracker = new StateTracker(new FakeTrackerClock());
		settled = jest.fn(() => Promise.resolve());
	});

	it('is a condition with a yes and a no output that lists its device, channel and property', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: DEVICE_PROPERTY_COMPARE_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		});
		expect(registered.references({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: PROPERTY_NUMBER },
		]);
	});

	describe('configuration', () => {
		it.each([
			['eq', { value: 20 }],
			['neq', { value: 20 }],
			['gt', { value: 20 }],
			['gte', { value: 20 }],
			['lt', { value: 20 }],
			['lte', { value: 20 }],
			['between', { min: 18, max: 24 }],
			['in', { values: [18, 20, 22] }],
		])('accepts %s on a numeric property', async (operator, operands) => {
			expect(await problems({ ...target(PROPERTY_NUMBER), operator, ...operands })).toEqual([]);
		});

		it('offers a yes/no property only equality', async () => {
			expect(await problems({ ...target(PROPERTY_BOOL), operator: 'eq', value: true })).toEqual([]);
			expect(await problems({ ...target(PROPERTY_BOOL), operator: 'neq', value: false })).toEqual([]);

			for (const operator of ['gt', 'gte', 'lt', 'lte']) {
				expect(await problems({ ...target(PROPERTY_BOOL), operator, value: 1 })).toEqual([
					{
						field: 'operator',
						reason: `The operator ${operator} can not be used with this property. Use one of eq, neq.`,
					},
				]);
			}

			expect((await problems({ ...target(PROPERTY_BOOL), operator: 'in', values: [true] }))[0].field).toBe('operator');
			expect((await problems({ ...target(PROPERTY_BOOL), operator: 'between', min: 0, max: 1 }))[0].field).toBe(
				'operator',
			);
		});

		it('offers a text property equality and a list', async () => {
			expect(await problems({ ...target(PROPERTY_ENUM), operator: 'eq', value: 'heat' })).toEqual([]);
			expect(await problems({ ...target(PROPERTY_ENUM), operator: 'in', values: ['heat', 'cool'] })).toEqual([]);
			expect((await problems({ ...target(PROPERTY_ENUM), operator: 'between', min: 0, max: 1 }))[0]).toMatchObject({
				field: 'operator',
			});
		});

		it('publishes which operators go with which kind of value', () => {
			expect(COMPARE_OPERATORS_BY_VALUE_KIND).toEqual({
				number: COMPARE_OPERATORS,
				boolean: ['eq', 'neq'],
				string: ['eq', 'neq', 'in'],
				enum: ['eq', 'neq', 'in'],
				unknown: COMPARE_OPERATORS,
			});
			expect(card().configSchema).toMatchObject({
				required: ['device_id', 'channel_id', 'property_id', 'operator'],
				additionalProperties: false,
				properties: {
					operator: { type: 'string', enum: [...COMPARE_OPERATORS] },
					values: { type: 'array', minItems: 1, maxItems: 50 },
				},
				'x-operators-by-value-kind': COMPARE_OPERATORS_BY_VALUE_KIND,
			});
		});

		it.each([
			['no operator', {}, 'operator'],
			['an unknown operator', { operator: 'like', value: 'a' }, 'operator'],
			['a comparison without a value', { operator: 'eq' }, 'value'],
			['an ordering with a text', { operator: 'gt', value: 'warm' }, 'value'],
			['between without its lower end', { operator: 'between', max: 5 }, 'min'],
			['between without its upper end', { operator: 'between', min: 5 }, 'max'],
			['between with its ends the wrong way round', { operator: 'between', min: 5, max: 1 }, 'max'],
			['between with a value', { operator: 'between', min: 1, max: 5, value: 3 }, 'value'],
			['in without values', { operator: 'in' }, 'values'],
			['in with an empty list', { operator: 'in', values: [] }, 'values'],
			['in with a list of lists', { operator: 'in', values: [[1]] }, 'values'],
			['in with a single value', { operator: 'in', values: [1], value: 1 }, 'value'],
			['a comparison with a list', { operator: 'eq', value: 1, values: [1] }, 'values'],
			['a comparison with a range', { operator: 'lt', value: 1, min: 0 }, 'min'],
			['an unknown property', { operator: 'eq', value: 1, tolerance: 1 }, 'tolerance'],
		])('refuses %s', async (_name, extra, field) => {
			const found = await problems({ ...target(PROPERTY_NUMBER), ...extra });

			expect(found.map((problem) => problem.field)).toContain(field);
		});

		it('refuses more values than the limit', async () => {
			const values = Array.from({ length: 51 }, (_, index) => index);

			expect(await problems({ ...target(PROPERTY_NUMBER), operator: 'in', values })).toEqual([
				{ field: 'values', reason: 'At most 50 values are allowed.' },
			]);
		});

		it('refuses a value the property can not hold, and says which one', async () => {
			expect(await problems({ ...target(PROPERTY_NUMBER), operator: 'eq', value: 'warm' })).toEqual([
				{ field: 'value', reason: 'This property holds a number.' },
			]);
			expect(await problems({ ...target(PROPERTY_ENUM), operator: 'in', values: ['heat', 'dry', 3] })).toEqual([
				{ field: 'values.1', reason: 'This value is not one the property can hold.' },
				{ field: 'values.2', reason: 'This property holds one of a list of texts.' },
			]);
		});

		it('refuses a property that is not the one of the named channel and device', async () => {
			expect(await problems({ ...target(PROPERTY_NUMBER, DEVICE_B, CHANNEL_B), operator: 'lt', value: 50 })).toEqual([
				{ field: 'channel_id', reason: 'The property does not belong to this channel.' },
				{ field: 'device_id', reason: 'The property does not belong to this device.' },
			]);
		});

		it('leaves a property that does not exist to the engine', async () => {
			expect(await problems({ ...target(PROPERTY_MISSING), operator: 'gt', value: 1 })).toEqual([]);
		});
	});

	describe('evaluation', () => {
		it.each([
			['eq', { value: 20 }, 20, true],
			['eq', { value: 20 }, 21, false],
			['neq', { value: 20 }, 21, true],
			['neq', { value: 20 }, 20, false],
			['gt', { value: 20 }, 20.5, true],
			['gt', { value: 20 }, 20, false],
			['gte', { value: 20 }, 20, true],
			['gte', { value: 20 }, 19.9, false],
			['lt', { value: 20 }, 19.9, true],
			['lt', { value: 20 }, 20, false],
			['lte', { value: 20 }, 20, true],
			['lte', { value: 20 }, 20.1, false],
			['between', { min: 18, max: 24 }, 18, true],
			['between', { min: 18, max: 24 }, 24, true],
			['between', { min: 18, max: 24 }, 24.1, false],
			['between', { min: 18, max: 24 }, 17.9, false],
			['in', { values: [18, 20] }, 20, true],
			['in', { values: [18, 20] }, 19, false],
		])('%s %j against %p is %p', async (operator, operands, value, result) => {
			known(PROPERTY_NUMBER, { value });

			expect(await evaluate({ ...target(PROPERTY_NUMBER), operator, ...operands })).toEqual({
				result,
				observed: value,
			});
		});

		it('compares yes/no values and texts', async () => {
			known(PROPERTY_BOOL, { value: true });
			known(PROPERTY_ENUM, { value: 'heat' });

			expect(await evaluate({ ...target(PROPERTY_BOOL), operator: 'eq', value: true })).toEqual({
				result: true,
				observed: true,
			});
			expect(await evaluate({ ...target(PROPERTY_BOOL), operator: 'neq', value: true })).toMatchObject({
				result: false,
			});
			expect(await evaluate({ ...target(PROPERTY_ENUM), operator: 'in', values: ['heat', 'cool'] })).toMatchObject({
				result: true,
				observed: 'heat',
			});
		});

		it('does not take a text for the number it looks like', async () => {
			known(PROPERTY_NUMBER, { value: '20' });

			expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'eq', value: 20 })).toEqual({
				result: false,
				observed: '20',
			});
			expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'gt', value: 10 })).toEqual({
				result: false,
				reason: 'The value of the property is not a number.',
				observed: '20',
			});
			expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'between', min: 10, max: 30 })).toMatchObject({
				result: false,
				reason: 'The value of the property is not a number.',
			});
		});

		describe('unknown is not true', () => {
			it('answers no for a property with no value', async () => {
				known(PROPERTY_NUMBER, { value: null });

				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual({
					result: false,
					reason: 'The value of the property is not valid.',
				});
			});

			it('answers no for a property nothing is known about, after waiting for its baseline', async () => {
				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual({
					result: false,
					reason: 'The property has no known value.',
				});
				expect(settled).toHaveBeenCalledTimes(1);
			});

			it('uses a baseline that arrives while it waits', async () => {
				tracker.reference(PROPERTY_NUMBER);
				settled.mockImplementation(() => {
					tracker.seed(PROPERTY_NUMBER, { value: 10 });

					return Promise.resolve();
				});

				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual({
					result: true,
					observed: 10,
				});
			});

			it('answers no for an invalid value, and records the last value seen', async () => {
				known(PROPERTY_NUMBER, { value: 10 });
				tracker.setAvailability(PROPERTY_NUMBER, { valid: false });

				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual({
					result: false,
					reason: 'The value of the property is not valid.',
					observed: 10,
				});
			});

			it('answers no for an offline device, even when its last value would be true', async () => {
				known(PROPERTY_NUMBER, { value: 10 });
				tracker.setAvailability(PROPERTY_NUMBER, { online: false });

				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 })).toEqual({
					result: false,
					reason: 'The device is offline.',
					observed: 10,
				});
				// ... and "is not" is not true either
				expect(await evaluate({ ...target(PROPERTY_NUMBER), operator: 'neq', value: 99 })).toMatchObject({
					result: false,
					reason: 'The device is offline.',
				});
			});

			it('does not wait for a baseline when the value is known', async () => {
				known(PROPERTY_NUMBER, { value: 10 });

				await evaluate({ ...target(PROPERTY_NUMBER), operator: 'lt', value: 50 });

				expect(settled).not.toHaveBeenCalled();
			});
		});
	});
});
