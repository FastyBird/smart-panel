import Ajv, { ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = JSON.parse(readFileSync(join(__dirname, 'automation-templates.schema.json'), 'utf8')) as object;

const document = () => ({
	version: '1.0',
	templates: [
		{
			id: 'leak-alarm',
			name: 'Leak alarm',
			description: 'Sends a notification when water is detected.',
			mode: 'restart',
			parameters: [
				{ id: 'leak', type: 'property', label: 'Leak sensor', access: 'readable', property_categories: ['detected'] },
				{ id: 'title', type: 'text', label: 'Title', max_length: 120, default: 'Water leak detected' } as Record<
					string,
					unknown
				>,
			],
			graph: {
				nodes: [
					{
						id: 'n1',
						type: 'device.property.changed',
						position: { x: 0, y: 0 },
						config: { property_id: { $param: 'leak.property_id' }, to: true },
					},
				],
				edges: [] as unknown[],
			},
		},
	],
});

describe('automation-templates.schema.json', () => {
	let validate: ValidateFunction;

	beforeAll(() => {
		validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
	});

	it('compiles under strict mode and accepts a template', () => {
		expect(validate(document())).toBe(true);
	});

	it.each([
		['an unsupported version', (doc: ReturnType<typeof document>) => (doc.version = '2.0')],
		['a malformed id', (doc: ReturnType<typeof document>) => (doc.templates[0].id = 'Leak Alarm')],
		['an unknown mode', (doc: ReturnType<typeof document>) => (doc.templates[0].mode = 'queued')],
		[
			'an unknown parameter type',
			(doc: ReturnType<typeof document>) => (doc.templates[0].parameters[1].type = 'colour'),
		],
		[
			'a text parameter without max_length',
			(doc: ReturnType<typeof document>) => delete doc.templates[0].parameters[1].max_length,
		],
		[
			'an unknown key on a parameter',
			(doc: ReturnType<typeof document>) => (doc.templates[0].parameters[1].access = 'readable'),
		],
		['a graph without nodes', (doc: ReturnType<typeof document>) => (doc.templates[0].graph.nodes = [])],
		[
			'an edge without ports',
			(doc: ReturnType<typeof document>) => (doc.templates[0].graph.edges = [{ id: 'e1', source: 'n1', target: 'n1' }]),
		],
	])('rejects %s', (_name, mutate) => {
		const doc = document();
		mutate(doc);

		expect(validate(doc)).toBe(false);
	});

	it('rejects a duration longer than seven days', () => {
		const doc = document();
		doc.templates[0].parameters[1] = { id: 'wait', type: 'duration', label: 'Wait', min: 1, max: 604801 };

		expect(validate(doc)).toBe(false);
	});
});
