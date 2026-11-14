import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { DevicePropertyInfo } from '../nodes/device-property.utils';

import { AutomationTemplate } from './automation-template.types';
import {
	checkAutomationTemplate,
	checkAutomationTemplateAnswers,
	generateAutomationTemplateGraph,
	sampleAutomationTemplateAnswers,
} from './template-generator';

const DEVICE = '0d9f0a3e-6f5c-4d7e-9a43-000000000001';
const CHANNEL = '0d9f0a3e-6f5c-4d7e-9a43-000000000002';
const PROPERTY = '0d9f0a3e-6f5c-4d7e-9a43-000000000003';
const OTHER = '0d9f0a3e-6f5c-4d7e-9a43-000000000009';

const template = (): AutomationTemplate => ({
	id: 'test',
	name: 'Test',
	description: 'A test template.',
	mode: 'restart',
	parameters: [
		{
			id: 'sensor',
			type: 'property',
			label: 'Sensor',
			access: 'readable',
			channel_categories: ['motion'],
			property_categories: ['detected'],
			data_types: ['bool'],
		},
		{ id: 'wait', type: 'duration', label: 'Wait', min: 10, max: 600, default: 60 },
		{ id: 'level', type: 'number', label: 'Level', min: 5, max: 30, step: 0.5 },
		{ id: 'title', type: 'text', label: 'Title', max_length: 20, default: 'Hello' },
	],
	graph: {
		nodes: [
			{
				id: 'n1',
				type: 'trigger',
				position: { x: 0, y: 0 },
				config: {
					device_id: { $param: 'sensor.device_id' },
					channel_id: { $param: 'sensor.channel_id' },
					property_id: { $param: 'sensor.property_id' },
					for_seconds: { $param: 'wait' },
				},
			},
			{
				id: 'n2',
				type: 'action',
				position: { x: 300, y: 0 },
				config: { items: [{ value: { $param: 'level' }, fixed: true }], title: { $param: 'title' } },
			},
		],
		edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
	},
});

const sensor = (overrides: Partial<DevicePropertyInfo> = {}): DevicePropertyInfo => ({
	id: PROPERTY,
	channelId: CHANNEL,
	deviceId: DEVICE,
	dataType: DataTypeType.BOOL,
	format: null,
	invalid: null,
	step: null,
	permissions: [PermissionType.READ_ONLY],
	category: 'detected',
	channelCategory: 'motion',
	...overrides,
});

const answers = () => ({
	sensor: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY },
	level: 20.5,
});

describe('checkAutomationTemplate', () => {
	it('accepts a correct template', () => {
		expect(checkAutomationTemplate(template())).toEqual([]);
	});

	it('refuses a placeholder that names no parameter', () => {
		const t = template();
		t.graph.nodes[1].config.extra = { $param: 'missing' };

		expect(checkAutomationTemplate(t)).toEqual([
			'node n2 config extra: placeholder names parameter missing, which is not declared',
		]);
	});

	it('refuses a property placeholder without a field and a field on another parameter', () => {
		const t = template();
		t.graph.nodes[0].config.device_id = { $param: 'sensor' };
		t.graph.nodes[0].config.for_seconds = { $param: 'wait.seconds' };

		expect(checkAutomationTemplate(t)).toEqual([
			'node n1 config device_id: placeholder of property parameter sensor must name one of device_id, channel_id, property_id',
			'node n1 config for_seconds: placeholder of duration parameter wait must not name a field',
		]);
	});

	it('refuses a placeholder mixed with other keys', () => {
		const t = template();
		t.graph.nodes[1].config.title = { $param: 'title', other: 1 };

		expect(checkAutomationTemplate(t)).toEqual([
			'node n2 config: a placeholder must be { $param: <parameter>[.<field>] } alone',
			'parameter title is not used by the graph',
		]);
	});

	it('refuses an unused parameter, bounds that do not fit and duplicate identifiers', () => {
		const t = template();
		t.parameters.push({ id: 'unused', type: 'duration', label: 'Unused', min: 100, max: 10, default: 1000 });
		t.parameters.push({ id: 'title', type: 'text', label: 'Again', max_length: 3, default: 'Too long' });
		t.graph.nodes.push({ ...t.graph.nodes[1] });
		t.graph.edges.push({ id: 'e1', source: 'n1', source_port: 'out', target: 'n9', target_port: 'in' });

		expect(checkAutomationTemplate(t)).toEqual([
			'parameter unused: min must not be greater than max',
			'parameter unused: default must be between min and max',
			'parameter title is declared twice',
			'node n2 is declared twice',
			'edge e1 is declared twice',
			'edge e1 refers to node n9, which does not exist',
			'parameter unused is not used by the graph',
		]);
	});

	it('refuses a number default off the step', () => {
		const t = template();
		t.parameters[2] = { id: 'level', type: 'number', label: 'Level', min: 5, max: 30, step: 0.5, default: 7.3 };

		expect(checkAutomationTemplate(t)).toEqual(['parameter level: default must be on the step']);
	});
});

describe('checkAutomationTemplateAnswers', () => {
	const lookup = (property: DevicePropertyInfo | null) => jest.fn(() => Promise.resolve(property));

	it('accepts correct answers and fills in the defaults', async () => {
		const check = await checkAutomationTemplateAnswers(template(), answers(), lookup(sensor()));

		expect(check.issues).toEqual([]);
		expect(check.values).toEqual({ ...answers(), wait: 60, title: 'Hello' });
	});

	it('needs an answer to a question without a default and refuses unknown questions', async () => {
		const check = await checkAutomationTemplateAnswers(template(), { surprise: 1 }, lookup(sensor()));

		expect(check.issues).toEqual([
			{ field: 'parameters.surprise', reason: 'This template asks no such question.' },
			{ field: 'parameters.sensor', reason: 'An answer is needed.' },
			{ field: 'parameters.level', reason: 'An answer is needed.' },
		]);
	});

	it.each([
		['a duration out of bounds', { wait: 5 }, 'parameters.wait', 'The duration must be between 10 and 600 seconds.'],
		['a part of a second', { wait: 10.5 }, 'parameters.wait', 'The duration must be a whole number of seconds.'],
		['a number out of bounds', { level: 31 }, 'parameters.level', 'The number must be between 5 and 30.'],
		['a number off the step', { level: 20.2 }, 'parameters.level', 'The number must be a multiple of 0.5 from 5.'],
		['a number given as a text', { level: '20' }, 'parameters.level', 'The answer must be a number.'],
		['an empty text', { title: '   ' }, 'parameters.title', 'A text is needed.'],
		['a long text', { title: 'x'.repeat(21) }, 'parameters.title', 'The text can be at most 20 characters long.'],
	])('refuses %s', async (_name, patch, field, reason) => {
		const check = await checkAutomationTemplateAnswers(template(), { ...answers(), ...patch }, lookup(sensor()));

		expect(check.issues).toEqual([{ field, reason }]);
	});

	it('refuses a property answer that is not three ids', async () => {
		const check = await checkAutomationTemplateAnswers(
			template(),
			{ ...answers(), sensor: { device_id: DEVICE, property_id: 'nope', extra: true } },
			lookup(sensor()),
		);

		expect(check.issues).toEqual([
			{ field: 'parameters.sensor.channel_id', reason: 'A channel must be chosen.' },
			{ field: 'parameters.sensor.property_id', reason: 'A property must be chosen.' },
			{ field: 'parameters.sensor', reason: 'Only a device, a channel and a property can be given.' },
		]);
	});

	it('refuses a property that does not exist', async () => {
		const check = await checkAutomationTemplateAnswers(template(), answers(), lookup(null));

		expect(check.issues).toEqual([{ field: 'parameters.sensor.property_id', reason: 'The property does not exist.' }]);
	});

	it('refuses a property of another channel, of the wrong kind, data type or permission', async () => {
		const check = await checkAutomationTemplateAnswers(
			template(),
			answers(),
			lookup(
				sensor({
					channelId: OTHER,
					permissions: [PermissionType.WRITE_ONLY],
					category: 'on',
					channelCategory: 'light',
					dataType: DataTypeType.FLOAT,
				}),
			),
		);

		expect(check.issues).toEqual([
			{ field: 'parameters.sensor.channel_id', reason: 'The property does not belong to this channel.' },
			{ field: 'parameters.sensor.property_id', reason: 'This property can not be read.' },
			{ field: 'parameters.sensor.channel_id', reason: 'This channel is not of a kind this question takes.' },
			{ field: 'parameters.sensor.property_id', reason: 'This property is not of a kind this question takes.' },
			{
				field: 'parameters.sensor.property_id',
				reason: 'This property holds a kind of value this question does not take.',
			},
		]);
	});

	it('refuses a property that can not be set for a writable question', async () => {
		const t = template();
		t.parameters[0] = { id: 'sensor', type: 'property', label: 'Light', access: 'writable' };

		const check = await checkAutomationTemplateAnswers(t, answers(), lookup(sensor()));

		expect(check.issues).toEqual([{ field: 'parameters.sensor.property_id', reason: 'This property can not be set.' }]);
	});
});

describe('generateAutomationTemplateGraph', () => {
	it('puts every answer in place, keeping its type, and leaves the template untouched', () => {
		const t = template();
		const before = JSON.stringify(t);

		const graph = generateAutomationTemplateGraph(t, { ...answers(), wait: 60, title: 'Hello' });

		expect(graph).toEqual({
			version: 1,
			nodes: [
				{
					id: 'n1',
					type: 'trigger',
					position: { x: 0, y: 0 },
					config: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY, for_seconds: 60 },
				},
				{
					id: 'n2',
					type: 'action',
					position: { x: 300, y: 0 },
					config: { items: [{ value: 20.5, fixed: true }], title: 'Hello' },
				},
			],
			edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
		});
		expect(JSON.stringify(t)).toBe(before);
	});

	it('generates from the sample answers, which are inside the bounds', () => {
		const t = template();
		const values = sampleAutomationTemplateAnswers(t);

		expect(values).toMatchObject({ wait: 60, level: 5, title: 'Hello' });
		expect(() => generateAutomationTemplateGraph(t, values)).not.toThrow();
	});
});
