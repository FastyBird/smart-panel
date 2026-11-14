/**
 * A card of a third-party extension is typed against the extension SDK only and goes through exactly what a
 * built-in card goes through: the registry, the catalogue with its owner gating, the save check with the
 * safety policy, and the engine with the same safety policy before every action. The cards below import
 * nothing from the backend - that is the point of the suite.
 */
import {
	type AutomationActionCommand,
	type AutomationNodeConfig,
	type AutomationNodeConfigProblem,
	type AutomationNodeTypeOwner,
	type AutomationNodeTypeRegistrar,
	checkAutomationConfigKeys,
	defineAutomationAction,
	defineAutomationCondition,
	defineAutomationTrigger,
} from '@fastybird/smart-panel-extension-sdk';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { AutomationNodeTypesController } from '../controllers/node-types.controller';
import { AutomationEngine } from '../engine/automation-engine';
import { RunRecord } from '../engine/run-walker';
import { AutomationGraphIssueCode } from '../graph/graph-validator';
import { checkGraphForSave } from '../graph/save-policy';
import { flush } from '../testing/engine-harness';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import { isAutomationNodeTypeOwnerEnabled } from '../utils/node-type-owner.utils';

import { AutomationSafetyService } from './automation-safety.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

const OWNER: AutomationNodeTypeOwner = { kind: 'plugin', type: 'acme-extension' };

const LOCK = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00b001';
const LIGHT = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00b002';

const PROPERTIES: Record<string, ChannelPropertyEntity> = {
	[LOCK]: {
		id: LOCK,
		category: PropertyCategory.STATUS,
		channel: { category: ChannelCategory.LOCK, device: { category: DeviceCategory.LOCK } },
	} as unknown as ChannelPropertyEntity,
	[LIGHT]: {
		id: LIGHT,
		category: PropertyCategory.ON,
		channel: { category: ChannelCategory.LIGHT, device: { category: DeviceCategory.LIGHTING } },
	} as unknown as ChannelPropertyEntity,
};

/** What the extension's own little world looks like: signals it hears and the writes it makes */
class AcmeBridge {
	readonly listeners = new Set<(signal: string) => void>();
	readonly writes: { propertyId: string; value: unknown }[] = [];
	lastSignal: string | null = null;

	emit(signal: string): void {
		this.lastSignal = signal;

		for (const listener of [...this.listeners]) listener(signal);
	}
}

const textProblem = (config: AutomationNodeConfig, key: string): AutomationNodeConfigProblem[] =>
	typeof config[key] === 'string' && config[key] !== '' ? [] : [{ field: key, reason: 'A text is needed.' }];

const acmeCards = (bridge: AcmeBridge) => ({
	trigger: defineAutomationTrigger<{ signal: string }>({
		type: 'acme.signal.received',
		kind: 'trigger',
		name: 'Acme signal received',
		description: 'Fires when the Acme bridge hears a signal.',
		owner: OWNER,
		configSchema: { type: 'object', properties: { signal: { type: 'string' } }, required: ['signal'] },
		validateConfig: (config) => [...checkAutomationConfigKeys(config, ['signal']), ...textProblem(config, 'signal')],
		subscribe: (config, fire) => {
			const listener = (signal: string): void => {
				if (signal === config.signal) fire({ signal });
			};

			bridge.listeners.add(listener);

			return () => bridge.listeners.delete(listener);
		},
	}),
	condition: defineAutomationCondition<{ signal: string }>({
		type: 'acme.signal.last-is',
		kind: 'condition',
		name: 'Acme last signal is',
		description: 'Whether the last signal the bridge heard is the given one.',
		owner: OWNER,
		validateConfig: (config) => [...checkAutomationConfigKeys(config, ['signal']), ...textProblem(config, 'signal')],
		evaluate: (config) => Promise.resolve({ result: bridge.lastSignal === config.signal, observed: bridge.lastSignal }),
	}),
	action: defineAutomationAction<{ property_id: string; value: unknown }>({
		type: 'acme.property.pulse',
		kind: 'action',
		name: 'Acme pulse',
		description: 'Writes a value through the Acme bridge.',
		owner: OWNER,
		validateConfig: (config) => [
			...checkAutomationConfigKeys(config, ['property_id', 'value']),
			...textProblem(config, 'property_id'),
		],
		references: (config) =>
			typeof config.property_id === 'string' ? [{ kind: 'property', id: config.property_id }] : [],
		commands: (config): AutomationActionCommand[] =>
			typeof config.property_id === 'string'
				? [{ kind: 'property_write', propertyId: config.property_id, value: config.value, field: 'value' }]
				: [],
		execute: (config) => {
			bridge.writes.push({ propertyId: config.property_id, value: config.value });

			return Promise.resolve({ success: true });
		},
	}),
});

const pulseGraph = (propertyId: string, value: unknown) => ({
	version: 1,
	nodes: [
		{ id: 't', type: 'acme.signal.received', position: { x: 0, y: 0 }, config: { signal: 'ring' } },
		{ id: 'c', type: 'acme.signal.last-is', position: { x: 0, y: 0 }, config: { signal: 'ring' } },
		{ id: 'a', type: 'acme.property.pulse', position: { x: 0, y: 0 }, config: { property_id: propertyId, value } },
	],
	edges: [
		{ id: 'e1', source: 't', source_port: 'out', target: 'c', target_port: 'in' },
		{ id: 'e2', source: 'c', source_port: 'yes', target: 'a', target_port: 'in' },
	],
});

describe('automation cards of a third-party extension', () => {
	let bridge: AcmeBridge;
	let registry: AutomationNodeTypeRegistryService;
	let safety: AutomationSafetyService;
	let ownerEnabled: boolean;

	const configService = {
		getModuleConfig: () => ({ enabled: true }),
		getPluginConfig: (type: string) => (type === OWNER.type ? { enabled: ownerEnabled } : null),
	};

	beforeEach(() => {
		bridge = new AcmeBridge();
		ownerEnabled = true;
		registry = new AutomationNodeTypeRegistryService();

		// The registry is all an extension needs to know of the backend
		const registrar: AutomationNodeTypeRegistrar = registry;

		const cards = acmeCards(bridge);

		registrar.register(cards.trigger);
		registrar.register(cards.condition);
		registrar.register(cards.action);

		safety = new AutomationSafetyService(
			registry,
			{ findOne: (id: string) => Promise.resolve(PROPERTIES[id] ?? null) } as unknown as ChannelsPropertiesService,
			{ findEnabledActions: () => Promise.resolve([]) } as unknown as SceneExecutorService,
		);
	});

	describe('catalogue', () => {
		it('offers the cards with their default ports and schema while the extension is enabled', () => {
			const controller = new AutomationNodeTypesController(registry, configService as never);

			expect(controller.findAll().data).toEqual([
				expect.objectContaining({
					type: 'acme.property.pulse',
					kind: 'action',
					ports: { inputs: ['in'], outputs: ['done', 'error'] },
					// A card without a schema is edited as JSON by the generic form
					config_schema: { type: 'object', additionalProperties: true },
				}),
				expect.objectContaining({
					type: 'acme.signal.last-is',
					kind: 'condition',
					ports: { inputs: ['in'], outputs: ['yes', 'no'] },
				}),
				expect.objectContaining({
					type: 'acme.signal.received',
					kind: 'trigger',
					ports: { inputs: [], outputs: ['out'] },
					config_schema: { type: 'object', properties: { signal: { type: 'string' } }, required: ['signal'] },
				}),
			]);
		});

		it('leaves the cards out while the extension is disabled', () => {
			ownerEnabled = false;

			expect(new AutomationNodeTypesController(registry, configService as never).findAll().data).toEqual([]);
		});

		it('refuses a card the engine could not use when it is registered', () => {
			expect(() =>
				registry.register(
					defineAutomationTrigger({
						type: 'Acme Bad',
						kind: 'trigger',
						name: 'Bad',
						description: '',
						owner: OWNER,
						validateConfig: () => [],
						subscribe: () => () => undefined,
					}),
				),
			).toThrow(/identifier/);
		});
	});

	describe('saving', () => {
		const check = (graph: unknown, enabled = true) =>
			checkGraphForSave(graph, registry.lookup, { enabled, safety: safety.checkGraph });

		it('accepts a graph of the cards that does nothing unsafe', async () => {
			expect(await check(pulseGraph(LIGHT, true))).toEqual({ valid: true, issues: [] });
		});

		it('runs the configuration check of the card', async () => {
			const graph = pulseGraph(LIGHT, true);
			graph.nodes[0].config = { signal: '', extra: 1 } as never;

			const result = await check(graph);

			expect(result.valid).toBe(false);
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: AutomationGraphIssueCode.INVALID_CONFIG, node_id: 't', field: 'extra' }),
					expect.objectContaining({ code: AutomationGraphIssueCode.INVALID_CONFIG, node_id: 't', field: 'signal' }),
				]),
			);
			// A disabled draft may hold an unfinished configuration
			expect((await check(graph, false)).valid).toBe(true);
		});

		it('refuses an action of the extension that would unlock a lock, even as a disabled draft', async () => {
			for (const enabled of [true, false]) {
				const result = await check(pulseGraph(LOCK, 'unlocked'), enabled);

				expect(result.valid).toBe(false);
				expect(result.issues).toEqual([
					expect.objectContaining({
						code: AutomationGraphIssueCode.SAFETY_REDUCING_ACTION,
						node_id: 'a',
						field: 'value',
						message: 'An automation can not unlock a lock.',
						blocking: true,
					}),
				]);
			}
		});
	});

	describe('running', () => {
		let clock: FakeTrackerClock;
		let engine: AutomationEngine;
		let settled: RunRecord[];

		const load = (graph: unknown) =>
			engine.load({ id: 'automation-1', enabled: true, mode: 'restart', revision: 1, graph });

		beforeEach(() => {
			clock = new FakeTrackerClock();
			settled = [];
			engine = new AutomationEngine({
				lookup: registry.lookup,
				clock,
				isOwnerEnabled: (owner) => isAutomationNodeTypeOwnerEnabled(configService as never, owner),
				// The very policy the automations module hands the engine
				actionPolicy: (request) => safety.checkAction(request),
				hooks: { runSettled: (record) => settled.push(record) },
			});
		});

		const ring = async (): Promise<void> => {
			bridge.emit('ring');
			await flush();
			await flush();
		};

		it('arms the trigger, evaluates the condition and executes the action', async () => {
			expect(await load(pulseGraph(LIGHT, true))).toMatchObject({ status: 'ok', armed: true, armedTriggers: 1 });
			expect(bridge.listeners.size).toBe(1);

			await ring();

			expect(bridge.writes).toEqual([{ propertyId: LIGHT, value: true }]);
			expect(settled[0]).toMatchObject({ status: 'completed', trigger: { nodeId: 't', data: { signal: 'ring' } } });
			expect(settled[0].steps.map((step) => [step.nodeId, step.output])).toEqual([
				['c', 'yes'],
				['a', 'done'],
			]);
		});

		it('refuses an unsafe action of the extension before it executes, whatever was saved', async () => {
			// The save check would not have let this graph through; the engine checks again before every action
			await load(pulseGraph(LOCK, 'unlocked'));
			await ring();

			expect(bridge.writes).toEqual([]);
			expect(settled[0].steps[1]).toMatchObject({
				nodeId: 'a',
				output: 'error',
				refused: true,
				reason: 'An automation can not unlock a lock.',
			});
		});

		it('does not arm the trigger of a disabled extension', async () => {
			ownerEnabled = false;

			await load(pulseGraph(LIGHT, true));
			await ring();

			expect(bridge.listeners.size).toBe(0);
			expect(bridge.writes).toEqual([]);
		});

		it('releases what the trigger holds when the automation is unloaded', async () => {
			await load(pulseGraph(LIGHT, true));

			expect(bridge.listeners.size).toBe(1);

			await engine.remove('automation-1');

			expect(bridge.listeners.size).toBe(0);
		});
	});
});
