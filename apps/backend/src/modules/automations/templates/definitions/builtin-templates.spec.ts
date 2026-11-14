import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../../config/services/config.service';
import { ChannelCategory, DataTypeType, PermissionType, PropertyCategory } from '../../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../devices/services/channels.properties.service';
import { PropertyCommandService } from '../../../devices/services/property-command.service';
import { NotificationsService } from '../../../notifications/services/notifications.service';
import { SceneExecutorService } from '../../../scenes/services/scene-executor.service';
import { SecurityService } from '../../../security/services/security.service';
import { HouseMode } from '../../../system/system.constants';
import { checkGraphForSave } from '../../graph/save-policy';
import { AutomationBuiltInNodeTypesService } from '../../nodes/built-in-node-types.service';
import { AutomationEngineService } from '../../services/automation-engine.service';
import { AutomationSafetyService } from '../../services/automation-safety.service';
import { AutomationsService } from '../../services/automations.service';
import { AutomationEventSourceService } from '../../services/event-source.service';
import { AutomationNodeTypeRegistryService } from '../../services/node-type-registry.service';
import { AutomationStateTrackerService } from '../../services/state-tracker.service';
import { AutomationTimeSourceService } from '../../services/time-source.service';
import { AutomationTemplatesService } from '../automation-templates.service';

const SCHEMA_PATH = join(__dirname, '../schema/automation-templates.schema.json');

interface FakeProperty {
	device: string;
	channel: string;
	property: string;
	channelCategory: ChannelCategory;
	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	format?: number[] | null;
}

let counter = 0;

const uuid = (): string => `0d9f0a3e-6f5c-4d7e-9a43-${String(++counter).padStart(12, '0')}`;

const fakeProperty = (spec: Omit<FakeProperty, 'device' | 'channel' | 'property'>): FakeProperty => ({
	device: uuid(),
	channel: uuid(),
	property: uuid(),
	...spec,
});

const answer = (property: FakeProperty) => ({
	device_id: property.device,
	channel_id: property.channel,
	property_id: property.property,
});

const MOTION = fakeProperty({
	channelCategory: ChannelCategory.MOTION,
	category: PropertyCategory.DETECTED,
	dataType: DataTypeType.BOOL,
	permissions: [PermissionType.READ_ONLY],
});
const LIGHT = fakeProperty({
	channelCategory: ChannelCategory.LIGHT,
	category: PropertyCategory.ON,
	dataType: DataTypeType.BOOL,
	permissions: [PermissionType.READ_WRITE],
});
const CONTACT = fakeProperty({
	channelCategory: ChannelCategory.CONTACT,
	category: PropertyCategory.DETECTED,
	dataType: DataTypeType.BOOL,
	permissions: [PermissionType.READ_ONLY],
});
const LEAK = fakeProperty({
	channelCategory: ChannelCategory.LEAK,
	category: PropertyCategory.DETECTED,
	dataType: DataTypeType.BOOL,
	permissions: [PermissionType.READ_ONLY],
});
const HEATER = fakeProperty({
	channelCategory: ChannelCategory.HEATER,
	category: PropertyCategory.TEMPERATURE,
	dataType: DataTypeType.FLOAT,
	permissions: [PermissionType.READ_WRITE],
	format: [0, 100],
});

const PROPERTIES = [MOTION, LIGHT, CONTACT, LEAK, HEATER];

const toEntity = (property: FakeProperty): ChannelPropertyEntity =>
	({
		id: property.property,
		category: property.category,
		dataType: property.dataType,
		format: property.format ?? null,
		invalid: null,
		step: null,
		permissions: property.permissions,
		channel: { id: property.channel, category: property.channelCategory, device: { id: property.device } },
	}) as unknown as ChannelPropertyEntity;

describe('built-in automation templates', () => {
	let userDirectory: string;
	let registry: AutomationNodeTypeRegistryService;
	let service: AutomationTemplatesService;

	beforeEach(async () => {
		userDirectory = mkdtempSync(join(tmpdir(), 'automation-builtin-templates-'));

		const findOne = jest.fn((id: string) => {
			const property = PROPERTIES.find((item) => item.property === id);

			return Promise.resolve(property ? toEntity(property) : null);
		});

		// The real cards of the module, so every template is checked against what a save checks
		const cards = new AutomationBuiltInNodeTypesService(
			{ watch: jest.fn(), read: jest.fn(), settled: jest.fn() } as unknown as AutomationStateTrackerService,
			{
				onTimeOfDay: jest.fn(),
				houseNow: jest.fn(),
				unavailableReason: jest.fn(() => null),
			} as unknown as AutomationTimeSourceService,
			{ findOne } as unknown as ChannelsPropertiesService,
			{ executePropertyCommands: jest.fn() } as unknown as PropertyCommandService,
			{ triggerScene: jest.fn() } as unknown as SceneExecutorService,
			{ notify: jest.fn() } as unknown as NotificationsService,
			{ sceneGuard: jest.fn() } as unknown as AutomationSafetyService,
			{
				onButtonOccurrence: jest.fn(),
				onDeviceConnection: jest.fn(),
				onSceneRun: jest.fn(),
				onHouseModeChanged: jest.fn(),
				onSecurityStateChanged: jest.fn(),
			} as unknown as AutomationEventSourceService,
			{ getModuleConfig: jest.fn(() => ({ houseMode: HouseMode.HOME })) } as unknown as ConfigService,
			{ getStatus: jest.fn() } as unknown as SecurityService,
			{ findOne: jest.fn(), update: jest.fn() } as unknown as AutomationsService,
			{ triggerOrThrow: jest.fn() } as unknown as AutomationEngineService,
		);

		registry = new AutomationNodeTypeRegistryService();

		for (const nodeType of cards.create()) {
			registry.register(nodeType);
		}

		const config = { get: (key: string) => (key === 'FB_CONFIG_PATH' ? userDirectory : undefined) };

		const automations = {
			checkGraph: (graph: unknown, enabled: boolean) => checkGraphForSave(graph, registry.lookup, { enabled }),
		};

		service = new AutomationTemplatesService(
			config as unknown as NestConfigService,
			registry,
			automations as unknown as AutomationsService,
			{ findOne } as unknown as ChannelsPropertiesService,
			{ builtinDirectory: __dirname, schemaPath: SCHEMA_PATH },
		);

		jest.spyOn(Object.getPrototypeOf((service as unknown as { logger: object }).logger), 'log').mockImplementation();

		await service.reload();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		rmSync(userDirectory, { recursive: true, force: true });
	});

	/** The generated graph passes the validation of a save of an enabled automation, with no issue at all */
	const expectSavable = async (graph: unknown): Promise<void> => {
		const check = await checkGraphForSave(graph, registry.lookup, { enabled: true });

		expect(check.issues).toEqual([]);
		expect(check.valid).toBe(true);
	};

	it('loads the four built-in templates without errors', () => {
		const catalog = service.catalog();

		expect(catalog.files.flatMap((file) => file.errors)).toEqual([]);
		expect(catalog.templates.map((entry) => entry.template.id)).toEqual([
			'away-heating-setback',
			'door-open-reminder',
			'leak-alarm',
			'motion-light',
		]);
		expect(catalog.templates.every((entry) => entry.source === 'builtin')).toBe(true);
	});

	describe('motion-light', () => {
		it('turns the light on on motion and off once no motion was seen for the duration', async () => {
			const draft = await service.generate('motion-light', {
				motion: answer(MOTION),
				light: answer(LIGHT),
				off_after: 300,
			});

			expect(draft.name).toBe('Motion light');
			expect(draft.mode).toBe('parallel');

			const [onTrigger, onAction, offTrigger, offAction] = draft.graph.nodes;

			expect(onTrigger).toMatchObject({ type: 'device.property.changed', config: { ...answer(MOTION), to: true } });
			expect(onAction).toMatchObject({
				type: 'device.property.set',
				config: { writes: [{ ...answer(LIGHT), value: true }] },
			});
			expect(offTrigger).toMatchObject({
				type: 'device.property.changed',
				config: { ...answer(MOTION), to: false, for_seconds: 300 },
			});
			expect(offAction).toMatchObject({ config: { writes: [{ ...answer(LIGHT), value: false }] } });
			expect(draft.graph.edges).toHaveLength(2);

			await expectSavable(draft.graph);
		});

		it('uses the default duration when none is given', async () => {
			const draft = await service.generate('motion-light', { motion: answer(MOTION), light: answer(LIGHT) });

			expect(draft.graph.nodes[2].config.for_seconds).toBe(120);
		});
	});

	describe('door-open-reminder', () => {
		it('sends a warning once the contact stayed open for the duration', async () => {
			const draft = await service.generate('door-open-reminder', {
				contact: answer(CONTACT),
				open_for: 600,
				title: '  Front door is open  ',
			});

			expect(draft.mode).toBe('restart');
			expect(draft.graph.nodes[0]).toMatchObject({ config: { ...answer(CONTACT), to: true, for_seconds: 600 } });
			expect(draft.graph.nodes[1]).toMatchObject({
				type: 'notification.send',
				config: { severity: 'warning', title: 'Front door is open' },
			});

			await expectSavable(draft.graph);
		});
	});

	describe('away-heating-setback', () => {
		it('sets the heater back when the house goes away and restores it when it leaves away', async () => {
			const draft = await service.generate('away-heating-setback', {
				heater: answer(HEATER),
				away_temperature: 15.5,
				home_temperature: 22,
			});

			expect(draft.graph.nodes.map((node) => [node.type, node.config])).toEqual([
				['house-mode.changed', { to: 'away' }],
				['device.property.set', { writes: [{ ...answer(HEATER), value: 15.5 }] }],
				['house-mode.changed', { from: 'away' }],
				['device.property.set', { writes: [{ ...answer(HEATER), value: 22 }] }],
			]);

			await expectSavable(draft.graph);
		});
	});

	describe('leak-alarm', () => {
		it('sends a critical notification when water is detected', async () => {
			const draft = await service.generate('leak-alarm', { leak: answer(LEAK) });

			expect(draft.graph.nodes[0]).toMatchObject({ config: { ...answer(LEAK), to: true } });
			expect(draft.graph.nodes[1]).toMatchObject({
				type: 'notification.send',
				config: { severity: 'critical', title: 'Water leak detected' },
			});

			await expectSavable(draft.graph);
		});
	});

	it('generates graphs that keep no trace of the template', async () => {
		const draft = await service.generate('leak-alarm', { leak: answer(LEAK) });

		expect(JSON.stringify(draft.graph)).not.toContain('leak-alarm');
		expect(JSON.stringify(draft.graph)).not.toContain('$param');
		expect(Object.keys(draft)).toEqual(['name', 'mode', 'graph']);
	});
});
