import Ajv, { ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = JSON.parse(readFileSync(join(__dirname, 'modbus-templates.schema.json'), 'utf8')) as object;

const qingjun = () => ({
	version: '1.0',
	templates: [
		{
			id: 'qingjun-32di',
			name: 'Qingjun 32-channel digital input board',
			manufacturer: 'Qingjun',
			model: '32DI',
			description: '32 dry-contact inputs, Modbus TCP.',
			category: 'input_controller',
			defaults: {
				framing: 'tcp',
				port: 8080,
				unit_id: { default: 1, min: 0, max: 31, hint: 'Must match the DIP switches' },
				poll_interval_ms: 250,
				byte_order: 'big',
				word_order: 'big',
			},
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
				},
			],
		},
	],
});

describe('modbus-templates.schema.json', () => {
	let validate: ValidateFunction;

	beforeAll(() => {
		validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
	});

	const binding = (doc: ReturnType<typeof qingjun>) =>
		doc.templates[0].channels[0].properties[0].read as Record<string, unknown>;

	it('compiles under strict mode and accepts the qingjun example', () => {
		expect(validate(qingjun())).toBe(true);
	});

	it('rejects a formula on a binding', () => {
		const doc = qingjun();
		binding(doc).formula = 'x * 2';

		expect(validate(doc)).toBe(false);
		expect(validate.errors?.map((e) => e.message)).toContain('must NOT have additional properties');
	});

	it.each([
		['address out of range', (b: Record<string, unknown>) => (b.address = 70000)],
		['bit out of range', (b: Record<string, unknown>) => (b.bit = 16)],
		['unknown register type', (b: Record<string, unknown>) => (b.register_type = 'coils')],
	])('rejects %s', (_name, mutate) => {
		const doc = qingjun();
		mutate(binding(doc));

		expect(validate(doc)).toBe(false);
	});

	it('rejects a repeat count of 0', () => {
		const doc = qingjun();
		doc.templates[0].channels[0].repeat = { count: 0 };

		expect(validate(doc)).toBe(false);
	});

	it('accepts 64 channel entries and rejects 65', () => {
		const doc = qingjun();
		const channel = doc.templates[0].channels[0];

		doc.templates[0].channels = Array.from({ length: 64 }, () => channel);
		expect(validate(doc)).toBe(true);

		doc.templates[0].channels.push(channel);
		expect(validate(doc)).toBe(false);
	});

	it('rejects 33 properties on a channel', () => {
		const doc = qingjun();
		const property = doc.templates[0].channels[0].properties[0];

		doc.templates[0].channels[0].properties = Array.from({ length: 33 }, () => property);

		expect(validate(doc)).toBe(false);
	});

	it('rejects 65 templates in a file', () => {
		const doc = qingjun();

		doc.templates = Array.from({ length: 65 }, () => doc.templates[0]);

		expect(validate(doc)).toBe(false);
	});

	it('rejects a malformed id', () => {
		const doc = qingjun();
		doc.templates[0].id = 'Bad Id';

		expect(validate(doc)).toBe(false);
	});

	it('rejects an unsupported version', () => {
		const doc = qingjun();
		doc.version = '2.0';

		expect(validate(doc)).toBe(false);
	});
});
