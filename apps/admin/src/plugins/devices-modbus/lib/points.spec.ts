import { describe, expect, it } from 'vitest';

import {
	DevicesModbusPluginByteOrder as BO,
	DevicesModbusPluginDataType as DT,
	DevicesModbusPluginRegisterType as RT,
	DevicesModbusPluginWriteFunction as WF,
} from '../../../openapi.constants';
import type { IModbusTemplatePreview } from '../store/templates.types';

import {
	type ModbusPoint,
	type ModbusPointBase,
	type ModbusPointBinding,
	bindingIssues,
	pointsFromPreview,
	pointsFromRange,
	removePoint,
	samePoints,
	suggestCategory,
	toCreateRequest,
	toRequestBinding,
	toUpdateRequest,
	valueMapValueFromText,
} from './points';

const binding = (over: Partial<ModbusPointBinding> = {}): ModbusPointBinding => ({
	registerType: RT.coil,
	address: 0,
	dataType: DT.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
	longPressMs: null,
	...over,
});

const base = (over: Partial<ModbusPointBase> = {}): ModbusPointBase => ({
	channelCategory: 'switcher',
	propertyCategory: 'on',
	propertyIdentifier: null,
	propertyName: null,
	format: null,
	dataType: 'bool',
	permissions: ['rw'],
	staticValue: null,
	unit: null,
	read: binding(),
	write: binding(),
	...over,
});

const preview: IModbusTemplatePreview = {
	templateId: 'relay-board',
	templateRevision: 'abcdef0123456789',
	category: 'switcher' as IModbusTemplatePreview['category'],
	manufacturer: 'Acme',
	model: 'R8',
	endpointDefaults: { framing: 'tcp' as never, port: 502 },
	unitId: 1,
	pollIntervalMs: 1000,
	byteOrder: BO.big,
	wordOrder: BO.big,
	maxReadRegisters: null,
	maxReadBits: null,
	maxReadGap: null,
	channels: [
		{
			identifier: 'relay_1',
			name: 'Relay 1',
			category: 'switcher',
			properties: [
				{
					category: 'on',
					dataType: 'bool',
					permissions: ['rw'],
					read: {
						registerType: RT.holding_register,
						address: 1,
						dataType: DT.uint16,
						byteOrder: null,
						wordOrder: BO.little,
						valueMap: [
							{ raw: 1, value: true },
							{ raw: 0, value: false },
						],
					},
					write: {
						registerType: RT.holding_register,
						address: 1,
						dataType: DT.uint16,
						valueMap: [
							{ raw: 256, value: true },
							{ raw: 512, value: false },
						],
						writeFunction: 'single' as never,
					},
				},
			],
		},
		{
			identifier: 'temp',
			name: 'Temperature',
			category: 'temperature',
			properties: [
				{
					category: 'temperature',
					dataType: 'float',
					permissions: ['ro'],
					unit: '°C',
					read: { registerType: RT.input_register, address: 3, dataType: DT.int16, scale: 0.1, offset: -5, bit: 2, invert: true },
				},
			],
		},
		{
			identifier: 'device_information',
			name: 'Device information',
			category: 'device_information',
			properties: [{ category: 'manufacturer', dataType: 'string', permissions: ['ro'], staticValue: 'Acme' }],
		},
	],
};

const input = (points: ModbusPoint[], template: { id: string; revision: string; points: ModbusPoint[] } | null = null) => ({
	name: 'Board',
	category: 'switcher',
	roomId: null,
	endpointId: 'ep-1',
	unitId: 3,
	pollIntervalMs: 500,
	byteOrder: BO.big,
	wordOrder: BO.little,
	points,
	template,
});

describe('pointsFromRange', () => {
	it('creates one point per address with unique keys, names and identifiers', () => {
		const points = pointsFromRange(base(), { registerType: null, start: 10, count: 3 }, 'Relay');

		expect(points.map((p) => p.name)).toEqual(['Relay 1', 'Relay 2', 'Relay 3']);
		expect(points.map((p) => p.channelIdentifier)).toEqual(['relay_1', 'relay_2', 'relay_3']);
		expect(points.map((p) => p.read?.address)).toEqual([10, 11, 12]);
		expect(points.map((p) => p.write?.address)).toEqual([10, 11, 12]);
		expect(new Set(points.map((p) => p.key)).size).toBe(3);
	});

	it('takes the register type from a modicon range', () => {
		const [point] = pointsFromRange(base(), { registerType: RT.holding_register, start: 0, count: 1 }, 'R');

		expect(point.read?.registerType).toBe(RT.holding_register);
		expect(point.write?.registerType).toBe(RT.holding_register);
	});

	it('slugs identifiers and avoids existing ones', () => {
		const points = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'Čerpadlo / Pump!', ['cerpadlo_pump_1']);
		const ids = points.map((p) => p.channelIdentifier);

		expect(ids.every((id) => /^[a-z0-9_]+$/.test(id))).toBe(true);
		expect(new Set(ids).size).toBe(2);
		expect(ids).not.toContain('cerpadlo_pump_1');
	});

	it('falls back to a generic identifier for an unsluggable prefix', () => {
		const [point] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, '###');

		expect(point.channelIdentifier).toMatch(/^[a-z0-9_]+$/);
		expect(point.channelIdentifier).not.toBe('');
	});

	it('keeps keys unique across calls', () => {
		const a = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'A');
		const b = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'A');

		expect(new Set([...a, ...b].map((p) => p.key)).size).toBe(4);
	});

	it('does not share binding objects between points', () => {
		const [a, b] = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'A');

		expect(a.read).not.toBe(b.read);
	});
});

describe('suggestCategory', () => {
	it('suggests switcher when any point is writable', () => {
		expect(
			suggestCategory([
				...pointsFromRange(base({ write: null, permissions: ['ro'] }), { registerType: null, start: 0, count: 1 }, 'A'),
				...pointsFromRange(base(), { registerType: null, start: 1, count: 1 }, 'B'),
			])
		).toBe('switcher');
	});

	it('suggests input_controller otherwise, also for no points', () => {
		expect(suggestCategory(pointsFromRange(base({ write: null }), { registerType: null, start: 0, count: 2 }, 'A'))).toBe('input_controller');
		expect(suggestCategory([])).toBe('input_controller');
	});

	it('suggests valve for any valve point, even next to other writable points', () => {
		expect(
			suggestCategory([
				...pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A'),
				...pointsFromRange(base({ channelCategory: 'valve' }), { registerType: null, start: 1, count: 1 }, 'V'),
			])
		).toBe('valve');
	});

	it('suggests sensor when every bound point measures a quantity, ignoring static points', () => {
		const measured = ['temperature', 'humidity', 'electrical_power', 'pressure', 'illuminance', 'analog_input'].flatMap((category, index) =>
			pointsFromRange(
				base({ channelCategory: category, propertyCategory: 'value', dataType: 'float', permissions: ['ro'], write: null }),
				{ registerType: null, start: index, count: 1 },
				category
			)
		);
		const information = pointsFromRange(
			base({ channelCategory: 'device_information', propertyCategory: 'manufacturer', staticValue: 'Acme', read: null, write: null }),
			{ registerType: null, start: 0, count: 1 },
			'Info'
		);

		expect(suggestCategory([...measured, ...information])).toBe('sensor');
		expect(
			suggestCategory([...measured, ...pointsFromRange(base({ write: null, permissions: ['ro'] }), { registerType: null, start: 9, count: 1 }, 'A')])
		).toBe('input_controller');
		expect(suggestCategory(information)).toBe('input_controller');
	});
});

describe('samePoints', () => {
	it('ignores keys but sees edits, additions and removals', () => {
		const a = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'A');
		const b = pointsFromRange(base(), { registerType: null, start: 0, count: 2 }, 'A');

		expect(samePoints(a, b)).toBe(true);
		expect(samePoints(a, b.slice(0, 1))).toBe(false);
		expect(samePoints(a, [b[0], { ...b[1], name: 'Other' }])).toBe(false);
		expect(samePoints(a, [b[0], { ...b[1], read: binding({ address: 99 }) }])).toBe(false);
	});
});

describe('pointsFromPreview', () => {
	it('flattens channels and properties, normalising defaults and null orders', () => {
		const points = pointsFromPreview(preview);

		expect(points).toHaveLength(3);
		expect(points[0]).toMatchObject({ name: 'Relay 1', channelIdentifier: 'relay_1', channelCategory: 'switcher', propertyCategory: 'on' });
		expect(points[0].read).toMatchObject({
			byteOrder: null,
			wordOrder: BO.little,
			scale: 1,
			offset: 0,
			invert: false,
			bit: null,
			writeFunction: null,
		});
		expect(points[0].write?.writeFunction).toBe('single');
		expect(points[1]).toMatchObject({ unit: '°C', write: null });
		expect(points[1].read).toMatchObject({ scale: 0.1, offset: -5, bit: 2, invert: true, valueMap: null });
		expect(points[2]).toMatchObject({ staticValue: 'Acme', read: null, write: null });
		expect(new Set(points.map((p) => p.key)).size).toBe(3);
		expect(points.every((p) => p.channelId === null && p.propertyId === null)).toBe(true);
		expect(points[0].read?.longPressMs).toBeNull();
	});

	it('takes the long press of a template button', () => {
		const [point] = pointsFromPreview({
			...preview,
			channels: [
				{
					identifier: 'button_1',
					name: 'Button 1',
					category: 'button',
					properties: [
						{
							category: 'event',
							dataType: 'enum',
							permissions: ['ev'],
							read: { registerType: RT.discrete_input, address: 2, dataType: DT.bool, longPressMs: 1500 },
						},
					],
				},
			],
		});

		expect(point.read?.longPressMs).toBe(1500);
		expect(toRequestBinding(point.read!)).toEqual({ register_type: 'discrete_input', address: 2, data_type: 'bool', long_press_ms: 1500 });
	});
});

describe('pointsFromRange ids', () => {
	it('starts new points without channel and property ids', () => {
		const [point] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');

		expect([point.channelId, point.propertyId]).toEqual([null, null]);
	});
});

describe('toRequestBinding long press', () => {
	it('sends the long press only when it is set', () => {
		expect(toRequestBinding(binding({ registerType: RT.discrete_input, longPressMs: 1200 }))).toEqual({
			register_type: 'discrete_input',
			address: 0,
			data_type: 'bool',
			long_press_ms: 1200,
		});
		expect(toRequestBinding(binding())).not.toHaveProperty('long_press_ms');
	});
});

describe('removePoint', () => {
	const valve = (start: number, prefix: string): ModbusPoint[] => [
		...pointsFromRange(
			[
				base({ channelCategory: 'valve' }),
				base({
					channelCategory: 'valve',
					propertyCategory: 'type',
					dataType: 'enum',
					permissions: ['ro'],
					staticValue: 'generic',
					read: null,
					write: null,
				}),
			],
			{ registerType: null, start, count: 1 },
			prefix
		),
	];

	it('removes the static siblings with the last bound point of their channel', () => {
		const points = [...valve(0, 'A'), ...valve(1, 'B')];

		expect(removePoint(points, points[0].key).map((p) => [p.channelIdentifier, p.propertyCategory])).toEqual([
			['b_1', 'on'],
			['b_1', 'type'],
		]);
	});

	it('keeps a channel that still has a bound point, and static-only channels', () => {
		const [on, type] = valve(0, 'A');
		const state: ModbusPoint = { ...on, key: 'state', propertyCategory: 'state', write: null, permissions: ['ro'] };
		const [information, model] = pointsFromRange(
			[
				base({ channelCategory: 'device_information', propertyCategory: 'manufacturer', staticValue: 'Acme', read: null, write: null }),
				base({ channelCategory: 'device_information', propertyCategory: 'model', staticValue: 'R8', read: null, write: null }),
			],
			{ registerType: null, start: 0, count: 1 },
			'Info'
		);

		expect(removePoint([on, type, state], on.key).map((p) => p.propertyCategory)).toEqual(['type', 'state']);
		expect(removePoint([on, type, information, model], information.key).map((p) => p.propertyCategory)).toEqual(['on', 'type', 'model']);
	});
});

describe('empty value maps', () => {
	it('imports an empty value map from a template as no map, keeping its scale and offset', () => {
		const points = pointsFromPreview({
			...preview,
			channels: [
				{
					identifier: 'temp',
					name: 'Temperature',
					category: 'temperature',
					properties: [
						{
							category: 'temperature',
							dataType: 'float',
							permissions: ['ro'],
							read: { registerType: RT.input_register, address: 3, dataType: DT.int16, scale: 0.1, offset: -5, valueMap: [] },
						},
					],
				},
			],
		});

		expect(points[0].read?.valueMap).toBeNull();
		expect(toRequestBinding(points[0].read!)).toEqual({
			register_type: 'input_register',
			address: 3,
			data_type: 'int16',
			scale: 0.1,
			offset: -5,
		});
	});

	it('sends the scale and offset of a binding whose value map is empty', () => {
		const binding = {
			...pointsFromPreview(preview)[1].read!,
			bit: null,
			invert: false,
			valueMap: [],
		};

		expect(toRequestBinding(binding)).toEqual({ register_type: 'input_register', address: 3, data_type: 'int16', scale: 0.1, offset: -5 });
	});
});

describe('toCreateRequest', () => {
	it('round-trips a relay with read and write value maps and static channels', () => {
		const points = pointsFromPreview(preview);
		const { data } = toCreateRequest(input(points));

		const relay = data.channels[0];
		expect(relay).toMatchObject({ identifier: 'relay_1', name: 'Relay 1', category: 'switcher' });
		expect(relay.properties[0]).toMatchObject({ category: 'on', data_type: 'bool', permissions: ['rw'] });
		expect(relay.properties[0].read).toEqual({
			register_type: 'holding_register',
			address: 1,
			data_type: 'uint16',
			word_order: 'little',
			value_map: [
				{ raw: 1, value: true },
				{ raw: 0, value: false },
			],
		});
		expect(relay.properties[0].write).toEqual({
			register_type: 'holding_register',
			address: 1,
			data_type: 'uint16',
			write_function: 'single',
			value_map: [
				{ raw: 256, value: true },
				{ raw: 512, value: false },
			],
		});
		expect(data.channels[1].properties[0]).toMatchObject({ unit: '°C' });
		expect(data.channels[1].properties[0].read).toEqual({
			register_type: 'input_register',
			address: 3,
			data_type: 'int16',
			bit: 2,
			scale: 0.1,
			offset: -5,
			invert: true,
		});
		expect(data.channels[1].properties[0].write).toBeUndefined();
		expect(data.channels[2].properties[0]).toMatchObject({ category: 'manufacturer', static_value: 'Acme' });
		expect(data.channels[2].properties[0].read).toBeUndefined();
		expect(data.channels[2].properties[0].write).toBeUndefined();
	});

	it('always sends the device settings and nothing else optional', () => {
		const { data } = toCreateRequest(input(pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A')));

		expect(data).toMatchObject({
			name: 'Board',
			category: 'switcher',
			endpoint_id: 'ep-1',
			unit_id: 3,
			poll_interval_ms: 500,
			byte_order: 'big',
			word_order: 'little',
		});
		expect(data.room_id).toBeUndefined();
		expect(data.template_id).toBeUndefined();
	});

	it('sends the room when set', () => {
		expect(toCreateRequest({ ...input([]), roomId: 'room-1' }).data.room_id).toBe('room-1');
	});

	it('keeps template provenance for unchanged points and drops it after an edit', () => {
		const templatePoints = pointsFromPreview(preview);
		const template = { id: 'relay-board', revision: 'abcdef0123456789', points: templatePoints };

		const unchanged = toCreateRequest(input(pointsFromPreview(preview), template)).data;
		expect(unchanged.template_id).toBe('relay-board');
		expect(unchanged.template_revision).toBe('abcdef0123456789');

		const edited = pointsFromPreview(preview);
		edited[0] = { ...edited[0], name: 'Renamed' };
		const dropped = toCreateRequest(input(edited, template)).data;
		expect(dropped.template_id).toBeUndefined();
		expect(dropped.template_revision).toBeUndefined();

		expect(toCreateRequest(input(templatePoints.slice(1), template)).data.template_id).toBeUndefined();
	});

	it('keeps property identifier, name, format, binding poll interval and device fields from a template', () => {
		const rich: IModbusTemplatePreview = {
			...preview,
			maxReadRegisters: 50,
			maxReadBits: 800,
			maxReadGap: 2,
			channels: [
				{
					identifier: 'level',
					name: 'Level',
					category: 'humidity',
					properties: [
						{
							category: 'humidity',
							identifier: 'level_pct',
							name: 'Level %',
							dataType: 'uchar',
							permissions: ['ro'],
							unit: '%',
							format: [0, 100],
							read: { registerType: RT.input_register, address: 7, dataType: DT.uint16, pollIntervalMs: 5000 },
						},
					],
				},
			],
		};
		const points = pointsFromPreview(rich);
		const template = { id: 'rich', revision: 'r1', points };
		const { data } = toCreateRequest({
			...input(pointsFromPreview(rich), template),
			manufacturer: 'Acme',
			model: 'R8',
			maxReadRegisters: 50,
			maxReadBits: 800,
			maxReadGap: 2,
		});

		expect(data).toEqual({
			name: 'Board',
			category: 'switcher',
			endpoint_id: 'ep-1',
			unit_id: 3,
			poll_interval_ms: 500,
			byte_order: 'big',
			word_order: 'little',
			max_read_registers: 50,
			max_read_bits: 800,
			max_read_gap: 2,
			manufacturer: 'Acme',
			model: 'R8',
			template_id: 'rich',
			template_revision: 'r1',
			channels: [
				{
					identifier: 'level',
					name: 'Level',
					category: 'humidity',
					properties: [
						{
							identifier: 'level_pct',
							name: 'Level %',
							category: 'humidity',
							data_type: 'uchar',
							permissions: ['ro'],
							unit: '%',
							format: [0, 100],
							read: { register_type: 'input_register', address: 7, data_type: 'uint16', poll_interval_ms: 5000 },
						},
					],
				},
			],
		});
		expect(samePoints(points, [{ ...points[0], format: [0, 99] }])).toBe(false);
		expect(samePoints(points, [{ ...points[0], propertyName: null }])).toBe(false);
	});

	it('throws when points sharing a channel disagree on its name or category', () => {
		const [a] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');

		expect(() => toCreateRequest(input([a, { ...a, key: 'x', name: 'Other' }]))).toThrow(/disagree/);
		expect(() => toCreateRequest(input([a, { ...a, key: 'x', channelCategory: 'outlet' }]))).toThrow(/disagree/);
	});

	it('sends channel and property ids only when the point has them', () => {
		const [a] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');
		const { data } = toCreateRequest(input([a, { ...a, key: 'b', channelIdentifier: 'b', channelId: 'ch-b', propertyId: 'pr-b' }]));

		expect(data.channels[0]).not.toHaveProperty('id');
		expect(data.channels[0].properties[0]).not.toHaveProperty('id');
		expect(data.channels[1].id).toBe('ch-b');
		expect(data.channels[1].properties[0].id).toBe('pr-b');
	});

	it('merges points sharing a channel identifier into one channel', () => {
		const [a] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');
		const b: ModbusPoint = { ...a, key: 'other', propertyCategory: 'state', write: null, permissions: ['ro'] };
		const { data } = toCreateRequest(input([a, b]));

		expect(data.channels).toHaveLength(1);
		expect(data.channels[0].properties.map((p) => p.category)).toEqual(['on', 'state']);
	});
});

describe('toUpdateRequest', () => {
	it('sends the device settings and the channels, keeping the ids of existing channels and properties', () => {
		const [relay] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'Relay');
		const existing: ModbusPoint = { ...relay, channelId: 'ch-1', propertyId: 'pr-1' };
		const added: ModbusPoint = {
			...relay,
			key: 'state',
			propertyCategory: 'state',
			write: null,
			permissions: ['ro'],
			channelId: 'ch-1',
			propertyId: null,
		};
		const [fresh] = pointsFromRange(base(), { registerType: null, start: 1, count: 1 }, 'New');

		expect(
			toUpdateRequest({ category: 'switcher', pollIntervalMs: 250, byteOrder: BO.big, wordOrder: BO.little, points: [existing, added, fresh] })
		).toEqual({
			data: {
				category: 'switcher',
				poll_interval_ms: 250,
				byte_order: 'big',
				word_order: 'little',
				channels: [
					{
						id: 'ch-1',
						identifier: 'relay_1',
						name: 'Relay 1',
						category: 'switcher',
						properties: [
							{
								id: 'pr-1',
								category: 'on',
								data_type: 'bool',
								permissions: ['rw'],
								read: { register_type: 'coil', address: 0, data_type: 'bool' },
								write: { register_type: 'coil', address: 0, data_type: 'bool' },
							},
							{
								category: 'state',
								data_type: 'bool',
								permissions: ['ro'],
								read: { register_type: 'coil', address: 0, data_type: 'bool' },
							},
						],
					},
					{
						identifier: 'new_1',
						name: 'New 1',
						category: 'switcher',
						properties: [
							{
								category: 'on',
								data_type: 'bool',
								permissions: ['rw'],
								read: { register_type: 'coil', address: 1, data_type: 'bool' },
								write: { register_type: 'coil', address: 1, data_type: 'bool' },
							},
						],
					},
				],
			},
		});
	});

	it('throws when points sharing a channel disagree on its id', () => {
		const [a] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');

		expect(() =>
			toUpdateRequest({
				category: 'switcher',
				pollIntervalMs: 250,
				byteOrder: BO.big,
				wordOrder: BO.big,
				points: [
					{ ...a, channelId: 'ch-1' },
					{ ...a, key: 'x', channelId: 'ch-2' },
				],
			})
		).toThrow(/disagree/);
	});
});

describe('valueMapValueFromText', () => {
	it('turns numeric text into a number for a numeric property', () => {
		expect(valueMapValueFromText('1', 'uchar')).toBe(1);
		expect(valueMapValueFromText('2.5', 'float')).toBe(2.5);
	});

	it('keeps the text of a string or enum property, leading zeros included', () => {
		expect(valueMapValueFromText('01', 'string')).toBe('01');
		expect(valueMapValueFromText('1', 'enum')).toBe('1');
	});

	it('keeps text that is not a number, and an empty input, as text', () => {
		expect(valueMapValueFromText('on', 'uint')).toBe('on');
		expect(valueMapValueFromText('', 'int')).toBe('');
	});
});

describe('bindingIssues', () => {
	it('accepts a plain binding', () => {
		expect(bindingIssues(binding(), 'write')).toEqual({});
	});

	it('requires the bool data type on coils and discrete inputs', () => {
		expect(bindingIssues(binding({ dataType: DT.uint16 }), 'read').dataType).toBe('devicesModbusPlugin.wizard.points.errors.bitTableBool');
	});

	it('refuses a 32-bit value on the last register', () => {
		const last = binding({ registerType: RT.holding_register, dataType: DT.uint32, address: 65535 });

		expect(bindingIssues(last, 'read').address).toBe('devicesModbusPlugin.wizard.points.errors.beyondAddressSpace');
		expect(bindingIssues({ ...last, dataType: DT.uint16 }, 'read').address).toBeUndefined();
	});

	it('refuses a value map combined with invert, float32, scale or repeated entries', () => {
		const mapped = binding({
			registerType: RT.holding_register,
			dataType: DT.uint16,
			valueMap: [
				{ raw: 0, value: 'off' },
				{ raw: 1, value: 'on' },
			],
		});

		expect(bindingIssues(mapped, 'read')).toEqual({});
		expect(bindingIssues({ ...mapped, invert: true }, 'read').invert).toBe('devicesModbusPlugin.wizard.points.errors.valueMapInvert');
		expect(bindingIssues({ ...mapped, dataType: DT.float32 }, 'read').valueMap).toBe('devicesModbusPlugin.wizard.points.errors.valueMapFloat');
		expect(bindingIssues({ ...mapped, scale: 10 }, 'read').valueMap).toBe('devicesModbusPlugin.wizard.points.errors.valueMapScaled');
		expect(
			bindingIssues(
				{
					...mapped,
					valueMap: [
						{ raw: 1, value: 'off' },
						{ raw: 1, value: 'on' },
					],
				},
				'read'
			).valueMap
		).toBe('devicesModbusPlugin.wizard.points.errors.valueMapRawUnique');
		expect(
			bindingIssues(
				{
					...mapped,
					valueMap: [
						{ raw: 0, value: 'on' },
						{ raw: 1, value: 'on' },
					],
				},
				'read'
			).valueMap
		).toBe('devicesModbusPlugin.wizard.points.errors.valueMapValueUnique');
		expect(bindingIssues({ ...mapped, valueMap: [{ raw: null as unknown as number, value: 'on' }] }, 'read').valueMap).toBe(
			'devicesModbusPlugin.wizard.points.errors.valueMapRaw'
		);
	});

	it('refuses a bit index that is not a whole number from 0 to 15', () => {
		const bitRead = binding({ registerType: RT.holding_register, bit: 3 });

		expect(bindingIssues(bitRead, 'read').bit).toBeUndefined();
		expect(bindingIssues({ ...bitRead, bit: 1.5 }, 'read').bit).toBe('devicesModbusPlugin.wizard.points.errors.bitRange');
		expect(bindingIssues({ ...bitRead, bit: 16 }, 'read').bit).toBe('devicesModbusPlugin.wizard.points.errors.bitRange');
	});

	it('refuses the single write function for a 32-bit value', () => {
		const wide = binding({ registerType: RT.holding_register, dataType: DT.int32, writeFunction: WF.single });

		expect(bindingIssues(wide, 'write').writeFunction).toBe('devicesModbusPlugin.wizard.points.errors.singleWrite32');
		expect(bindingIssues({ ...wide, writeFunction: WF.multiple }, 'write').writeFunction).toBeUndefined();
	});
});

describe('bindingIssues numeric and button points', () => {
	const E = 'devicesModbusPlugin.wizard.points.errors.';
	const press = (over: Partial<ModbusPointBinding> = {}) => binding({ registerType: RT.discrete_input, ...over });
	const reg = (over: Partial<ModbusPointBinding> = {}) => binding({ registerType: RT.input_register, dataType: DT.int16, ...over });

	it('holds a long press to a whole number from 100 to 10000 ms', () => {
		expect(bindingIssues(press({ longPressMs: 50 }), 'read', 'button').longPressMs).toBe(`${E}longPressRange`);
		expect(bindingIssues(press({ longPressMs: 20000 }), 'read', 'button').longPressMs).toBe(`${E}longPressRange`);
		expect(bindingIssues(press({ longPressMs: 150.5 }), 'read', 'button').longPressMs).toBe(`${E}longPressRange`);
		expect(bindingIssues(press({ longPressMs: 100 }), 'read', 'button')).toEqual({});
		expect(bindingIssues(press({ longPressMs: 10000 }), 'read', 'button')).toEqual({});
		expect(bindingIssues(press(), 'read', 'button')).toEqual({});
	});

	it('takes a long press on the read binding of a button event only', () => {
		expect(bindingIssues(press({ longPressMs: 800 }), 'read', 'bool').longPressMs).toBe(`${E}longPressNotButton`);
		expect(bindingIssues(press({ longPressMs: 800 }), 'read').longPressMs).toBe(`${E}longPressNotButton`);
		expect(bindingIssues(binding({ longPressMs: 800 }), 'write', 'button').longPressMs).toBe(`${E}longPressNotButton`);
	});

	it('reads a button level from a bit table or a register bit, without a value map', () => {
		const word = reg({ dataType: DT.bool });

		expect(bindingIssues(word, 'read', 'button').dataType).toBe(`${E}buttonLevel`);
		expect(bindingIssues({ ...word, bit: 2 }, 'read', 'button')).toEqual({});
		expect(bindingIssues(reg({ bit: 2 }), 'read', 'button').dataType).toBe(`${E}buttonLevel`);
		expect(bindingIssues(press({ valueMap: [{ raw: 1, value: true }] }), 'read', 'button').valueMap).toBe(`${E}buttonValueMap`);
	});

	it('refuses a number read as bool unless a bit is set, and a zero scale', () => {
		expect(bindingIssues(reg({ dataType: DT.bool }), 'read', 'number').dataType).toBe(`${E}numberBool`);
		expect(bindingIssues(reg({ dataType: DT.bool, bit: 1 }), 'read', 'number').dataType).toBeUndefined();
		expect(bindingIssues(reg({ dataType: DT.float32 }), 'read', 'number')).toEqual({});
		expect(bindingIssues(reg({ scale: 0 }), 'read', 'number').scale).toBe(`${E}scaleZero`);
		expect(bindingIssues(reg({ scale: 0.1, offset: -3 }), 'read', 'number')).toEqual({});
	});
});

describe('bindingIssues value map raw values', () => {
	const map = (raw: number) => [{ raw, value: 'on' }];
	const issue = (over: Partial<ModbusPointBinding>) => bindingIssues(binding(over), 'read').valueMap;
	const RANGE = 'devicesModbusPlugin.wizard.points.errors.valueMapRawRange';

	it('refuses a fraction', () => {
		expect(issue({ registerType: RT.holding_register, dataType: DT.uint16, valueMap: map(1.5) })).toBe(RANGE);
	});

	it('holds a coil, discrete input or single bit to 0 and 1', () => {
		expect(issue({ valueMap: map(2) })).toBe(RANGE);
		expect(issue({ registerType: RT.discrete_input, valueMap: map(1) })).toBeUndefined();
		expect(issue({ registerType: RT.holding_register, bit: 3, valueMap: map(2) })).toBe(RANGE);
	});

	it('lets a register read as bool without a bit use its whole word', () => {
		expect(issue({ registerType: RT.holding_register, valueMap: map(65535) })).toBeUndefined();
		expect(issue({ registerType: RT.holding_register, valueMap: map(65536) })).toBe(RANGE);
	});

	it('holds each integer type to its own range', () => {
		const register = { registerType: RT.input_register };

		expect(issue({ ...register, dataType: DT.int16, valueMap: map(-32768) })).toBeUndefined();
		expect(issue({ ...register, dataType: DT.int16, valueMap: map(40000) })).toBe(RANGE);
		expect(issue({ ...register, dataType: DT.uint16, valueMap: map(-1) })).toBe(RANGE);
		expect(issue({ ...register, dataType: DT.uint32, valueMap: map(4294967295) })).toBeUndefined();
		expect(issue({ ...register, dataType: DT.int32, valueMap: map(2147483648) })).toBe(RANGE);
	});
});
