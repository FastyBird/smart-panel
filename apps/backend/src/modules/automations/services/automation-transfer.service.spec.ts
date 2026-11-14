import { AutomationMode } from '../automations.constants';
import { AutomationsGraphValidationException, AutomationsImportException } from '../automations.exceptions';
import { AutomationEntity } from '../entities/automations.entity';
import { AutomationGraphSafetyCheck } from '../graph/graph-validator';
import { checkGraphForSave } from '../graph/save-policy';
import {
	FAKE_ACTION_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../testing/fake-node-types';
import { AutomationExportSource, automationExportProblem } from '../transfer/automation-yaml';

import { AutomationTransferService } from './automation-transfer.service';
import { AutomationsService } from './automations.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

const SCENE = '5ce00000-0000-4000-8000-000000000000';
const OTHER_SCENE = '5ce10000-0000-4000-8000-000000000000';
const SPACE = '5ba00000-0000-4000-8000-000000000000';
const AUTOMATION_ID = 'a0000000-0000-4000-8000-000000000000';

const GRAPH = {
	version: 1,
	nodes: [
		{
			id: 'when',
			type: FAKE_TRIGGER_TYPE,
			position: { x: 40, y: 80 },
			config: { camelCaseKey: true, nested: { list: [1, 'two', { three: 3 }] } },
		},
		{
			id: 'then',
			type: FAKE_STRICT_ACTION_TYPE,
			position: { x: 320.5, y: -80 },
			config: { level: 40, scene_id: SCENE },
		},
		{ id: 'unsafe', type: FAKE_ACTION_TYPE, position: { x: 600, y: 0 }, config: {} },
	],
	edges: [
		{ id: 'e1', source: 'when', source_port: 'out', target: 'then', target_port: 'in' },
		{ id: 'e2', source: 'then', source_port: 'done', target: 'unsafe', target_port: 'in' },
	],
};

const AUTOMATION = {
	id: AUTOMATION_ID,
	name: 'Hallway motion light',
	description: 'Night light',
	icon: 'mdi:motion-sensor',
	enabled: true,
	spaceId: SPACE,
	mode: AutomationMode.PARALLEL,
	graph: GRAPH,
	revision: 7,
} as unknown as AutomationEntity;

describe('AutomationTransferService', () => {
	let scenes: Set<string>;
	let spaces: Set<string>;
	let service: AutomationTransferService;

	beforeEach(() => {
		scenes = new Set([SCENE, OTHER_SCENE]);
		spaces = new Set([SPACE]);

		const registry = new AutomationNodeTypeRegistryService();

		for (const nodeType of FAKE_NODE_TYPES) {
			registry.register(nodeType);
		}

		// Refuses the plain test action whenever it is configured to unlock
		const safety: AutomationGraphSafetyCheck = (nodeType, config) =>
			nodeType.type === FAKE_ACTION_TYPE && config.unlock === true
				? [{ severity: 'error', message: 'An automation can not unlock a lock.', field: 'unlock' }]
				: [];

		const automations = {
			getOneOrThrow: jest.fn(() => Promise.resolve(AUTOMATION)),
			findOne: jest.fn(() => Promise.resolve(null)),
			checkGraph: (graph: unknown, enabled: boolean) => checkGraphForSave(graph, registry.lookup, { enabled, safety }),
			assertExportable: (source: AutomationExportSource) => {
				const problem = automationExportProblem(source);

				if (problem !== null) throw new AutomationsGraphValidationException(problem, []);
			},
		};

		const has = (set: () => Set<string>) => ({
			findOne: (id: string) => Promise.resolve(set().has(id) ? { id } : null),
		});

		service = new AutomationTransferService(
			automations as unknown as AutomationsService,
			registry,
			{ exists: () => Promise.resolve(false) } as never,
			{ exists: () => Promise.resolve(false) } as never,
			{ exists: () => Promise.resolve(false), findOne: () => Promise.resolve(null) } as never,
			has(() => scenes) as never,
			has(() => spaces) as never,
		);
	});

	const exported = async (): Promise<string> => (await service.exportAutomation(AUTOMATION_ID)).content;

	it('exports the automation under a file name made of its name', async () => {
		const result = await service.exportAutomation(AUTOMATION_ID);

		expect(result.fileName).toBe('hallway-motion-light.yaml');
		expect(result.content).toContain('kind: automation');
		expect(result.content).not.toContain(AUTOMATION_ID);
		expect(result.content).not.toContain('revision');
		expect(result.content).not.toContain('enabled');
	});

	it('reproduces the automation and its graph from its export', async () => {
		const preparation = await service.prepareImport(await exported());

		expect(preparation.draft).toEqual({
			name: 'Hallway motion light',
			description: 'Night light',
			icon: 'mdi:motion-sensor',
			mode: AutomationMode.PARALLEL,
			spaceId: SPACE,
			graph: GRAPH,
		});
		expect(preparation.missingReferences).toEqual([]);
		expect(preparation.issues.every((issue) => !issue.blocking)).toBe(true);
	});

	it('lists the references that do not exist here; a missing space is left out of the draft', async () => {
		scenes.clear();
		spaces.clear();

		const preparation = await service.prepareImport(await exported());

		expect(preparation.missingReferences).toEqual([
			{ kind: 'space', id: SPACE, usages: [{ nodeId: null, field: 'space_id' }], remappable: true },
			{ kind: 'scene', id: SCENE, usages: [{ nodeId: 'then', field: 'scene_id' }], remappable: true },
		]);
		expect(preparation.draft.spaceId).toBeNull();
		expect(preparation.draft.graph.nodes[1].config).toEqual({ level: 40, scene_id: SCENE });
	});

	it('points a missing reference at an entity that exists', async () => {
		scenes.delete(SCENE);

		const preparation = await service.prepareImport(await exported(), [{ kind: 'scene', id: SCENE, to: OTHER_SCENE }]);

		expect(preparation.missingReferences).toEqual([]);
		expect(preparation.draft.graph.nodes[1].config).toEqual({ level: 40, scene_id: OTHER_SCENE });
	});

	it('refuses a mapping to an entity that does not exist', async () => {
		const error = await service
			.prepareImport(await exported(), [{ kind: 'scene', id: SCENE, to: '5ce20000-0000-4000-8000-000000000000' }])
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(AutomationsImportException);
		expect((error as AutomationsImportException).issues).toEqual([
			{ field: 'mappings.0.to', reason: 'The scene to refer to instead does not exist.' },
		]);
	});

	it('refuses a mapping of a reference the file does not hold', async () => {
		const error = await service
			.prepareImport(await exported(), [{ kind: 'device', id: SCENE, to: OTHER_SCENE }])
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(AutomationsImportException);
		expect((error as AutomationsImportException).issues).toEqual([
			{ field: 'mappings.0.id', reason: 'The file does not refer to this device.' },
		]);
	});

	it('refuses a file a create request would refuse, field by field', async () => {
		const yaml = [
			'version: 1',
			'kind: automation',
			'name: ""',
			'mode: sometimes',
			'graph:',
			'  nodes:',
			'    - { id: a, type: t, position: { x: 0, y: 0 }, extra: 1 }',
			'    - { id: a, type: t, position: { x: 0, y: 0 } }',
			'  edges:',
			'    - { id: e, source: a, source_port: out, target: missing, target_port: in }',
		].join('\n');

		const error = await service.prepareImport(yaml).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(AutomationsImportException);

		const fields = (error as AutomationsImportException).issues.map((issue) => issue.field);

		expect(fields).toEqual(expect.arrayContaining(['name', 'mode', 'graph.nodes.0.extra']));
		expect(fields.some((field) => field.startsWith('graph'))).toBe(true);
	});

	it('refuses a number the stored automation could not keep, instead of storing null', async () => {
		const infinite = (await exported()).replace('level: 40', 'level: .inf');

		const error = await service.prepareImport(infinite).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(AutomationsImportException);
		expect((error as AutomationsImportException).issues).toEqual([
			expect.objectContaining({ field: 'graph.nodes.1.config.level' }),
		]);
	});

	it('refuses a file that is not YAML before anything is looked up', async () => {
		await expect(service.prepareImport('name: [')).rejects.toBeInstanceOf(AutomationsImportException);
	});

	it('refuses a graph that could not be saved even disabled: an unknown card or an action that reduces safety', async () => {
		const unsafe = (await exported()).replace(/config: \{\}/, 'config: { unlock: true }');

		const refusal = await service.prepareImport(unsafe).catch((caught: unknown) => caught);

		expect(refusal).toBeInstanceOf(AutomationsGraphValidationException);
		expect((refusal as AutomationsGraphValidationException).issues).toEqual([
			expect.objectContaining({ code: 'safety_reducing_action', node_id: 'unsafe', blocking: true }),
		]);

		const unknown = (await exported()).replace(`type: ${FAKE_ACTION_TYPE}`, 'type: no.such.card');

		const rejection = await service.prepareImport(unknown).catch((caught: unknown) => caught);

		expect(rejection).toBeInstanceOf(AutomationsGraphValidationException);
		expect((rejection as AutomationsGraphValidationException).issues).toEqual([
			expect.objectContaining({ code: 'unknown_node_type', node_id: 'unsafe', blocking: true }),
		]);
	});

	it('lets an incomplete configuration through as a warning of the disabled draft', async () => {
		const incomplete = (await exported()).replace('level: 40', 'level: 400');

		const preparation = await service.prepareImport(incomplete);

		expect(preparation.issues).toEqual([
			expect.objectContaining({ code: 'invalid_config', node_id: 'then', field: 'level', blocking: false }),
		]);
	});
});
