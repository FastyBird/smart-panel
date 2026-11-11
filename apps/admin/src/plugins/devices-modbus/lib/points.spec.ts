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
	type ModbusPointBinding,
	bindingIssues,
	pointsFromPreview,
	pointsFromRange,
	samePoints,
	suggestCategory,
	toCreateRequest,
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
	...over,
});

const base = (
	over: Partial<Omit<ModbusPoint, 'key' | 'name' | 'channelIdentifier'>> = {}
): Omit<ModbusPoint, 'key' | 'name' | 'channelIdentifier'> => ({
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

	it('merges points sharing a channel identifier into one channel', () => {
		const [a] = pointsFromRange(base(), { registerType: null, start: 0, count: 1 }, 'A');
		const b: ModbusPoint = { ...a, key: 'other', propertyCategory: 'state', write: null, permissions: ['ro'] };
		const { data } = toCreateRequest(input([a, b]));

		expect(data.channels).toHaveLength(1);
		expect(data.channels[0].properties.map((p) => p.category)).toEqual(['on', 'state']);
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

	it('refuses the single write function for a 32-bit value', () => {
		const wide = binding({ registerType: RT.holding_register, dataType: DT.int32, writeFunction: WF.single });

		expect(bindingIssues(wide, 'write').writeFunction).toBe('devicesModbusPlugin.wizard.points.errors.singleWrite32');
		expect(bindingIssues({ ...wide, writeFunction: WF.multiple }, 'write').writeFunction).toBeUndefined();
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
