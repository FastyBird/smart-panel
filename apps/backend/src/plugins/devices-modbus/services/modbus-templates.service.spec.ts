import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { ModbusTemplateNotFoundException, ModbusValidationException } from '../devices-modbus.exceptions';

import {
	MODBUS_TEMPLATES_LOCATIONS,
	ModbusTemplatesLocations,
	ModbusTemplatesService,
} from './modbus-templates.service';

const SCHEMA_PATH = join(__dirname, '../templates/schema/modbus-templates.schema.json');

const QINGJUN = `
id: qingjun-32di
name: Qingjun 32-channel digital input board
manufacturer: Qingjun
model: 32DI
category: input_controller
defaults:
  framing: tcp
  port: 8080
  unit_id: { default: 1, min: 0, max: 31 }
  poll_interval_ms: 250
  byte_order: big
  word_order: big
channels:
  - repeat: { count: 32 }
    identifier: 'di_{n}'
    name: 'DI {n}'
    category: binary_input
    properties:
      - category: state
        read:
          register_type: holding_register
          address: { base: 4, every: 16 }
          data_type: bool
          bit: { modulo: 16 }
`;

const indent = (text: string): string =>
	text
		.trim()
		.split('\n')
		.map((line) => `    ${line}`)
		.join('\n');

const file = (...templates: string[]): string =>
	`version: '1.0'\ntemplates:\n${templates.map((template) => `  - ${indent(template).trimStart()}`).join('\n')}\n`;

const replaceIn = (template: string, from: string, to: string): string => template.replace(from, to);

describe('ModbusTemplatesService', () => {
	let root: string;
	let builtin: string;
	let user: string;
	let values: Record<string, string | undefined>;
	let service: ModbusTemplatesService;

	const write = (directory: string, name: string, content: string): void => {
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, name), content);
	};

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'modbus-templates-'));
		builtin = join(root, 'builtin');
		user = join(root, 'user');
		mkdirSync(builtin);
		mkdirSync(user);
		values = { FB_CONFIG_PATH: user };

		const config = { get: (key: string) => values[key] } as unknown as NestConfigService;
		const locations: ModbusTemplatesLocations = { builtinDirectory: builtin, schemaPath: SCHEMA_PATH };

		service = new ModbusTemplatesService(config, new DeviceValidationService({} as never), locations);

		jest.spyOn(Object.getPrototypeOf((service as unknown as { logger: object }).logger), 'log').mockImplementation();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		rmSync(root, { recursive: true, force: true });
	});

	it('exposes the injection token', () => {
		expect(MODBUS_TEMPLATES_LOCATIONS).toBe('MODBUS_TEMPLATES_LOCATIONS');
	});

	it('lists valid built-in templates with revision and counts', () => {
		write(builtin, 'qingjun.yaml', file(QINGJUN));

		const catalog = service.reload();

		expect(catalog.files.flatMap((entry) => entry.errors)).toEqual([]);
		expect(catalog.templates).toHaveLength(1);
		expect(catalog.templates[0]).toMatchObject({
			source: 'builtin',
			overridesBuiltin: false,
			channelCount: 32,
			pointCount: 32,
		});
		expect(catalog.templates[0].template.id).toBe('qingjun-32di');
		expect(catalog.templates[0].revision).toMatch(/^[0-9a-f]{16}$/);
		expect(service.has('qingjun-32di')).toBe(true);
		expect(service.get('qingjun-32di')).toBe(catalog.templates[0]);
		expect(service.catalog()).toBe(catalog);
	});

	it('reports a template whose expansion fails validation and does not list it', () => {
		write(builtin, 'bad.yaml', file(replaceIn(QINGJUN, 'category: input_controller', 'category: not_a_category')));

		const catalog = service.reload();
		const errors = catalog.files.flatMap((entry) => entry.errors);

		expect(catalog.templates).toEqual([]);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.every((error) => error.startsWith('template qingjun-32di: '))).toBe(true);
		expect(errors.some((error) => error.startsWith('template qingjun-32di: category'))).toBe(true);
	});

	it('rejects a repeated channel whose identifier has no placeholder', () => {
		write(builtin, 'dup.yaml', file(replaceIn(QINGJUN, "identifier: 'di_{n}'", 'identifier: di')));

		const catalog = service.reload();
		const errors = catalog.files.flatMap((entry) => entry.errors);

		expect(catalog.templates).toEqual([]);
		expect(errors.some((error) => error.includes('identifier'))).toBe(true);
	});

	it('falls back to the built-in when the overriding user template is invalid', () => {
		write(builtin, 'qingjun.yaml', file(QINGJUN));
		write(
			user,
			'plugin.devices-modbus.custom.yaml',
			file(replaceIn(QINGJUN, 'category: input_controller', 'category: not_a_category')),
		);

		const catalog = service.reload();

		expect(catalog.templates).toHaveLength(1);
		expect(catalog.templates[0].source).toBe('builtin');
		expect(catalog.files.find((entry) => entry.source === 'user')?.errors.length).toBeGreaterThan(0);
	});

	it('lets a valid user template override the built-in one', () => {
		write(builtin, 'qingjun.yaml', file(QINGJUN));
		write(user, 'plugin.devices-modbus.custom.yaml', file(replaceIn(QINGJUN, 'model: 32DI', 'model: 32DI-X')));

		const [template] = service.reload().templates;

		expect(template).toMatchObject({ source: 'user', overridesBuiltin: true });
		expect(template.template.model).toBe('32DI-X');
	});

	it('uses FB_MODBUS_TEMPLATES_PATH on reload', () => {
		const extra = join(root, 'extra');

		write(join(extra, 'nested'), 'anything.yml', file(QINGJUN));

		expect(service.reload().templates).toEqual([]);

		values.FB_MODBUS_TEMPLATES_PATH = extra;

		const catalog = service.reload();

		expect(catalog.templates.map((entry) => entry.template.id)).toEqual(['qingjun-32di']);
		expect(catalog.templates[0].source).toBe('user');
	});

	it('get throws ModbusTemplateNotFoundException for an unknown id', () => {
		service.reload();

		expect(() => service.get('missing')).toThrow(ModbusTemplateNotFoundException);
		expect(() => service.get('missing')).toThrow('Modbus template missing does not exist');
		expect(service.has('missing')).toBe(false);
	});

	it('preview returns the expansion and maps expansion issues to a validation exception', () => {
		write(builtin, 'qingjun.yaml', file(QINGJUN));
		service.reload();

		const expansion = service.preview('qingjun-32di', { unit_id: 2 });

		expect(expansion.unit_id).toBe(2);
		expect(expansion.channels).toHaveLength(32);

		let thrown: unknown;

		try {
			service.preview('qingjun-32di', { unit_id: 99 });
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ModbusValidationException);
		expect(JSON.stringify((thrown as ModbusValidationException).getResponse())).toContain('\\"field\\":\\"unit_id\\"');
	});

	it('does not mutate a loaded template when previewing', () => {
		write(builtin, 'qingjun.yaml', file(QINGJUN));
		service.reload();

		const before = JSON.stringify(service.get('qingjun-32di').template);

		service.preview('qingjun-32di', {});

		expect(JSON.stringify(service.get('qingjun-32di').template)).toBe(before);
	});
});
