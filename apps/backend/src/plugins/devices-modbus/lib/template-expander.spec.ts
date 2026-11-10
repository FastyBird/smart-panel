import { ModbusTemplate } from '../templates/modbus-template.types';

import { ModbusTemplateExpansionError, expandModbusTemplate } from './template-expander';

const qingjun = (): ModbusTemplate => ({
	id: 'qingjun-32di',
	name: 'Qingjun 32-channel digital input board',
	manufacturer: 'Qingjun',
	model: '32DI',
	category: 'input_controller',
	defaults: {
		framing: 'tcp',
		port: 8080,
		unit_id: { default: 1, min: 0, max: 31 },
		poll_interval_ms: 250,
		byte_order: 'big',
		word_order: 'big',
	} as never,
	channels: [
		{
			repeat: { count: 32 },
			identifier: 'di_{n}',
			name: 'DI {n}',
			category: 'binary_input',
			properties: [
				{
					category: 'state',
					read: {
						register_type: 'holding_register',
						address: { base: 4, every: 16 },
						data_type: 'bool',
						bit: { modulo: 16 },
					},
				},
			],
		} as never,
	],
});

const single = (channel: Record<string, unknown>): ModbusTemplate => ({
	...qingjun(),
	defaults: undefined,
	channels: [channel as never],
});

const issuesOf = (fn: () => unknown) => {
	try {
		fn();
	} catch (error) {
		expect(error).toBeInstanceOf(ModbusTemplateExpansionError);

		return (error as ModbusTemplateExpansionError).issues;
	}

	throw new Error('expected expansion to throw');
};

describe('expandModbusTemplate', () => {
	it('expands the qingjun board into 32 channels', () => {
		const expansion = expandModbusTemplate(qingjun(), 'rev', { unit_id: 2 });
		const point = (n: number) => expansion.channels[n - 1].properties[0].read;

		expect(expansion.channels).toHaveLength(32);
		expect([point(1).address, point(1).bit]).toEqual([4, 0]);
		expect([point(16).address, point(16).bit]).toEqual([4, 15]);
		expect([point(17).address, point(17).bit]).toEqual([5, 0]);
		expect([point(32).address, point(32).bit]).toEqual([5, 15]);
		expect(expansion.channels[31]).toMatchObject({ identifier: 'di_32', name: 'DI 32', category: 'binary_input' });
		expect(expansion.channels[0].properties[0]).toMatchObject({ data_type: 'bool', permissions: ['ro'] });
		expect(expansion).toMatchObject({
			unit_id: 2,
			template_id: 'qingjun-32di',
			template_revision: 'rev',
			poll_interval_ms: 250,
			byte_order: 'big',
		});
	});

	it('uses the template default unit id when no override is given', () => {
		expect(expandModbusTemplate(qingjun(), 'rev').unit_id).toBe(1);
	});

	it('rejects a unit id outside the template range', () => {
		const issues = issuesOf(() => expandModbusTemplate(qingjun(), 'rev', { unit_id: 32 }));

		expect(issues).toContainEqual({ field: 'unit_id', reason: 'must be between 0 and 31' });
	});

	it('steps addresses one per item', () => {
		const expansion = expandModbusTemplate(
			single({
				repeat: { count: 8 },
				identifier: 'relay_{n}',
				name: 'Relay {n}',
				category: 'switcher',
				properties: [{ category: 'on', read: { register_type: 'coil', address: { base: 1 }, data_type: 'bool' } }],
			}),
			'rev',
		);

		expect(expansion.channels.map((c) => c.properties[0].read.address)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('rejects an unknown placeholder', () => {
		const issues = issuesOf(() =>
			expandModbusTemplate(
				single({
					repeat: { count: 2 },
					identifier: 'di_{x}',
					name: 'DI {n}',
					category: 'binary_input',
					properties: [{ category: 'state', read: { register_type: 'coil', address: 0, data_type: 'bool' } }],
				}),
				'rev',
			),
		);

		expect(issues).toContainEqual({ field: 'channels[0].identifier', reason: 'unknown placeholder {x}' });
	});

	it('rejects a computed address beyond 65535', () => {
		const issues = issuesOf(() =>
			expandModbusTemplate(
				single({
					repeat: { count: 8 },
					identifier: 'r_{n}',
					name: 'R {n}',
					category: 'switcher',
					properties: [
						{ category: 'on', read: { register_type: 'coil', address: { base: 65530 }, data_type: 'bool' } },
					],
				}),
				'rev',
			),
		);

		expect(issues.map((i) => i.field)).toEqual([
			'channels[6].properties[0].read.address',
			'channels[7].properties[0].read.address',
		]);
	});

	it('requires data_type when the spec has no metadata', () => {
		const issues = issuesOf(() =>
			expandModbusTemplate(
				single({
					identifier: 'di',
					name: 'DI',
					category: 'binary_input',
					properties: [{ category: 'brightness', read: { register_type: 'coil', address: 0, data_type: 'bool' } }],
				}),
				'rev',
			),
		);

		expect(issues).toContainEqual({
			field: 'channels[0].properties[0].data_type',
			reason: 'data_type is required for di.brightness',
		});
	});

	it('keeps value maps and write functions', () => {
		const valueMap = [
			{ raw: 0, value: false },
			{ raw: 1, value: true },
		];
		const expansion = expandModbusTemplate(
			single({
				identifier: 'relay_1',
				name: 'Relay 1',
				category: 'switcher',
				properties: [
					{
						category: 'on',
						read: { register_type: 'holding_register', address: 1, data_type: 'uint16', value_map: valueMap },
						write: {
							register_type: 'holding_register',
							address: 1,
							data_type: 'uint16',
							value_map: valueMap,
							write_function: 'single',
						},
					},
				],
			}),
			'rev',
		);
		const property = expansion.channels[0].properties[0];

		expect(property.read.value_map).toEqual(valueMap);
		expect(property.write).toMatchObject({ write_function: 'single', value_map: valueMap, address: 1 });
		expect(property).toMatchObject({ data_type: 'bool', permissions: ['rw'] });
	});
});
