import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import {
	AutomationsGraphValidationException,
	AutomationsTemplateNotFoundException,
	AutomationsTemplateParametersException,
} from '../automations.exceptions';
import { checkGraphForSave } from '../graph/save-policy';
import { AutomationsService } from '../services/automations.service';
import { AutomationNodeTypeRegistryService } from '../services/node-type-registry.service';

import { AutomationTemplatesService } from './automation-templates.service';

const SCHEMA_PATH = join(__dirname, 'schema/automation-templates.schema.json');

const DEVICE = '0d9f0a3e-6f5c-4d7e-9a43-000000000001';
const CHANNEL = '0d9f0a3e-6f5c-4d7e-9a43-000000000002';
const PROPERTY = '0d9f0a3e-6f5c-4d7e-9a43-000000000003';

const TEMPLATE = `
  - id: simple
    name: Simple
    description: A trigger and an action.
    mode: restart
    parameters:
      - id: sensor
        type: property
        label: Sensor
        access: readable
        property_categories: [detected]
      - id: wait
        type: duration
        label: Wait
        min: 10
        max: 600
        default: 60
    graph:
      nodes:
        - id: n1
          type: test.trigger
          position: { x: 0, y: 0 }
          config:
            property_id: { $param: sensor.property_id }
            for_seconds: { $param: wait }
        - id: n2
          type: test.action
          position: { x: 300, y: 0 }
          config: {}
      edges:
        - { id: e1, source: n1, source_port: out, target: n2, target_port: in }
`;

const file = (templates: string): string => `version: '1.0'\ntemplates:${templates}`;

describe('AutomationTemplatesService', () => {
	let builtin: string;
	let user: string;
	let override: string | undefined;
	let registry: AutomationNodeTypeRegistryService;
	let findOne: jest.Mock;
	let checkGraph: jest.Mock;
	let service: AutomationTemplatesService;
	let warn: jest.SpyInstance;

	const write = (directory: string, name: string, content: string): void => {
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, name), content);
	};

	beforeEach(() => {
		builtin = mkdtempSync(join(tmpdir(), 'automation-templates-builtin-'));
		user = mkdtempSync(join(tmpdir(), 'automation-templates-user-'));
		override = undefined;

		registry = new AutomationNodeTypeRegistryService();
		registry.register({
			type: 'test.trigger',
			kind: 'trigger',
			name: 'Trigger',
			description: '',
			validateConfig: () => [],
		});
		registry.register({
			type: 'test.action',
			kind: 'action',
			name: 'Action',
			description: '',
			validateConfig: () => [],
		});

		findOne = jest.fn(() =>
			Promise.resolve({
				id: PROPERTY,
				category: 'detected',
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				channel: { id: CHANNEL, category: 'motion', device: { id: DEVICE } },
			}),
		);

		checkGraph = jest.fn((graph: unknown, enabled: boolean) => checkGraphForSave(graph, registry.lookup, { enabled }));

		const config = {
			get: (key: string) => {
				if (key === 'FB_CONFIG_PATH') return user;
				if (key === 'FB_AUTOMATIONS_TEMPLATES_PATH') return override;

				return undefined;
			},
		};

		service = new AutomationTemplatesService(
			config as unknown as NestConfigService,
			registry,
			{ checkGraph } as unknown as AutomationsService,
			{ findOne } as unknown as ChannelsPropertiesService,
			{ builtinDirectory: builtin, schemaPath: SCHEMA_PATH },
		);

		const logger = Object.getPrototypeOf((service as unknown as { logger: object }).logger) as object;

		jest.spyOn(logger as { log: () => void }, 'log').mockImplementation();
		warn = jest.spyOn(logger as { warn: () => void }, 'warn').mockImplementation();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		rmSync(builtin, { recursive: true, force: true });
		rmSync(user, { recursive: true, force: true });
	});

	it('loads a valid file', async () => {
		write(builtin, 'simple.yaml', file(TEMPLATE));

		const catalog = await service.reload();

		expect(catalog.files).toEqual([{ source: 'builtin', path: 'simple.yaml', loaded: 1, errors: [], warnings: [] }]);
		expect(catalog.templates.map((entry) => entry.template.id)).toEqual(['simple']);
		expect(service.get('simple').template.parameters).toHaveLength(2);
	});

	it('rejects a file that does not follow the schema and says where', async () => {
		write(builtin, 'broken.yaml', file(TEMPLATE.replace('mode: restart', 'mode: queued')));

		const catalog = await service.reload();

		expect(catalog.templates).toEqual([]);
		expect(catalog.files[0].errors).toEqual(['/templates/0/mode: must be equal to one of the allowed values']);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken.yaml was not loaded'));
	});

	it('rejects a template with a placeholder naming no parameter', async () => {
		write(builtin, 'broken.yaml', file(TEMPLATE.replace('$param: wait', '$param: delay')));

		const catalog = await service.reload();

		expect(catalog.templates).toEqual([]);
		expect(catalog.files[0].errors).toEqual([
			'template simple: node n1 config for_seconds: placeholder names parameter delay, which is not declared',
			'template simple: parameter wait is not used by the graph',
		]);
	});

	it('rejects a template whose graph uses a node type or a port that does not exist', async () => {
		write(
			builtin,
			'broken.yaml',
			file(TEMPLATE.replace('type: test.action', 'type: test.missing').replace('source_port: out', 'source_port: yes')),
		);

		const catalog = await service.reload();

		expect(catalog.templates).toEqual([]);
		expect(catalog.files[0]).toMatchObject({ loaded: 0 });
		expect(catalog.files[0].errors).toEqual([
			expect.stringContaining('template simple: node n2: unknown_node_type'),
			'template simple: node n1: unknown_port: Node type "test.trigger" has no output port "yes".',
		]);
	});

	it('keeps the other templates of a file when one fails the graph check', async () => {
		write(
			builtin,
			'two.yaml',
			file(TEMPLATE + TEMPLATE.replace('id: simple', 'id: broken').replace('type: test.action', 'type: test.missing')),
		);

		const catalog = await service.reload();

		expect(catalog.templates.map((entry) => entry.template.id)).toEqual(['simple']);
		expect(catalog.files[0].loaded).toBe(1);
	});

	it('takes user templates from the configuration directory, by prefix, and lets them replace a built-in one', async () => {
		write(builtin, 'simple.yaml', file(TEMPLATE));
		write(user, 'module.automations.mine.yaml', file(TEMPLATE.replace('name: Simple', 'name: Mine')));
		write(user, 'other.yaml', file(TEMPLATE.replace('id: simple', 'id: ignored')));

		const catalog = await service.reload();

		expect(catalog.templates.map((entry) => [entry.template.id, entry.template.name, entry.source])).toEqual([
			['simple', 'Mine', 'user'],
		]);
		expect(catalog.templates[0].overridesBuiltin).toBe(true);
	});

	it('reads every file of the override directory instead of the configuration directory', async () => {
		override = mkdtempSync(join(tmpdir(), 'automation-templates-override-'));

		write(override, 'any-name.yaml', file(TEMPLATE.replace('id: simple', 'id: overridden')));
		write(user, 'module.automations.mine.yaml', file(TEMPLATE.replace('id: simple', 'id: mine')));

		const catalog = await service.reload();

		expect(catalog.templates.map((entry) => entry.template.id)).toEqual(['overridden']);

		rmSync(override, { recursive: true, force: true });
	});

	it('offers no template, and does not throw, when the definitions can not be loaded', async () => {
		(service as unknown as { locations: { schemaPath: string } }).locations.schemaPath = join(builtin, 'missing.json');

		jest
			.spyOn(Object.getPrototypeOf((service as unknown as { logger: object }).logger) as { error: () => void }, 'error')
			.mockImplementation();

		await expect(service.load()).resolves.toBeUndefined();

		expect(service.catalog().templates).toEqual([]);
		expect(service.catalog().files[0].errors[0]).toContain('missing.json');
	});

	describe('generate', () => {
		beforeEach(async () => {
			write(builtin, 'simple.yaml', file(TEMPLATE));

			await service.reload();
		});

		it('generates the draft of an enabled automation, checked as a save would check it', async () => {
			const draft = await service.generate('simple', {
				sensor: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY },
			});

			expect(draft).toEqual({
				name: 'Simple',
				mode: 'restart',
				graph: {
					version: 1,
					nodes: [
						{
							id: 'n1',
							type: 'test.trigger',
							position: { x: 0, y: 0 },
							config: { property_id: PROPERTY, for_seconds: 60 },
						},
						{ id: 'n2', type: 'test.action', position: { x: 300, y: 0 }, config: {} },
					],
					edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
				},
			});
			expect(checkGraph).toHaveBeenCalledWith(draft.graph, true);
			expect(findOne).toHaveBeenCalledWith(PROPERTY);
		});

		it('refuses answers that do not fit, with an issue per question', async () => {
			await expect(service.generate('simple', { wait: 5 })).rejects.toMatchObject({
				constructor: AutomationsTemplateParametersException,
				issues: [
					{ field: 'parameters.sensor', reason: 'An answer is needed.' },
					{ field: 'parameters.wait', reason: 'The duration must be between 10 and 600 seconds.' },
				],
			});
		});

		it('refuses a generated graph the server would not save', async () => {
			checkGraph.mockResolvedValueOnce({
				valid: false,
				issues: [{ severity: 'error', code: 'invalid_config', message: 'Never.', node_id: 'n2', blocking: true }],
			});

			await expect(
				service.generate('simple', { sensor: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY } }),
			).rejects.toBeInstanceOf(AutomationsGraphValidationException);
		});

		it('answers a template that does not exist', async () => {
			await expect(service.generate('missing', {})).rejects.toBeInstanceOf(AutomationsTemplateNotFoundException);
		});
	});
});
