import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import {
	AUTOMATIONS_MAX_COUNT,
	AUTOMATION_GRAPH_MAX_EDGES,
	AUTOMATION_GRAPH_MAX_NODES,
	AutomationMode,
	AutomationStatus,
	EventType,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsNotFoundException,
	AutomationsRevisionConflictException,
	AutomationsSpaceValidationException,
	AutomationsValidationException,
} from '../automations.exceptions';
import { CreateAutomationDto } from '../dto/create-automation.dto';
import { UpdateAutomationDto } from '../dto/update-automation.dto';
import { AutomationEntity } from '../entities/automations.entity';
import {
	FAKE_ACTION_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../testing/fake-node-types';

import { AutomationsService } from './automations.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

const SPACE_ID = '0b0f3f52-55d6-4b2f-9d8e-3f8b9b6f6a01';
const OTHER_SPACE_ID = '0b0f3f52-55d6-4b2f-9d8e-3f8b9b6f6a02';
const MISSING_ID = '0b0f3f52-55d6-4b2f-9d8e-3f8b9b6f6aff';

// No concrete node type ships with the module yet, so the tests register fake ones (see beforeEach)
const node = (id: string, config: Record<string, unknown> = {}, type: string = FAKE_ACTION_TYPE) => ({
	id,
	type,
	position: { x: 40, y: 80 },
	config,
});

const edge = (id: string, source: string, target: string) => ({
	id,
	source,
	source_port: 'out',
	target,
	target_port: 'in',
});

const graph = () => ({
	version: 1,
	nodes: [node('n1', { propertyId: 'p-1', to: true, nested: { keepCase: [1, 2] } }, FAKE_TRIGGER_TYPE), node('n2')],
	edges: [edge('e1', 'n1', 'n2')],
});

describe('AutomationsService', () => {
	let dataSource: DataSource;
	let repository: Repository<AutomationEntity>;
	let spacesService: { findOne: jest.Mock };
	let eventEmitter: { emit: jest.Mock };
	let nodeTypeRegistry: AutomationNodeTypeRegistryService;
	let service: AutomationsService;

	// The service accepts plain objects from in-process callers; the cast only satisfies the compiler.
	const create = (data: Record<string, unknown>) => service.create(data as unknown as CreateAutomationDto);
	const update = (id: string, data: Record<string, unknown>) =>
		service.update(id, data as unknown as UpdateAutomationDto);

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [AutomationEntity],
			synchronize: true,
		});
		await dataSource.initialize();

		repository = dataSource.getRepository(AutomationEntity);
		spacesService = {
			findOne: jest.fn((id: string) => Promise.resolve(id === SPACE_ID ? ({ id } as SpaceEntity) : null)),
		};
		eventEmitter = { emit: jest.fn() };

		nodeTypeRegistry = new AutomationNodeTypeRegistryService();

		for (const nodeType of FAKE_NODE_TYPES) {
			nodeTypeRegistry.register(nodeType);
		}

		service = new AutomationsService(
			repository,
			spacesService as unknown as SpacesService,
			eventEmitter as unknown as EventEmitter2,
			nodeTypeRegistry,
		);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	describe('create', () => {
		it('refuses another automation once the limit is reached', async () => {
			const count = jest.spyOn(repository, 'count');

			count.mockResolvedValueOnce(AUTOMATIONS_MAX_COUNT - 1);
			await expect(create({ name: 'Last one that fits' })).resolves.toBeInstanceOf(AutomationEntity);

			count.mockResolvedValueOnce(AUTOMATIONS_MAX_COUNT);
			await expect(create({ name: 'One too many' })).rejects.toThrow(AutomationsValidationException);

			count.mockRestore();

			expect(await repository.count()).toBe(1);
		});

		it('lets only one of two concurrent creates take the last free slot', async () => {
			for (let index = 0; index < AUTOMATIONS_MAX_COUNT - 1; index += 1) {
				await create({ name: `Automation ${index}` });
			}

			const results = await Promise.allSettled([create({ name: 'First' }), create({ name: 'Second' })]);

			expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
			expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
			expect(await repository.count()).toBe(AUTOMATIONS_MAX_COUNT);
		});

		it('still creates automations after a create was refused', async () => {
			await expect(create({ name: 'Bad space', space_id: '2f0d5d0e-6f3c-4a55-9f5c-1b9d4e1c7a10' })).rejects.toThrow();
			await expect(create({ name: 'Good one' })).resolves.toBeInstanceOf(AutomationEntity);
		});

		it('creates a disabled automation in restart mode with an empty graph at revision 1', async () => {
			const automation = await create({ name: 'Motion light' });

			expect(automation).toBeInstanceOf(AutomationEntity);
			expect(automation).toMatchObject({
				name: 'Motion light',
				description: null,
				icon: null,
				enabled: false,
				spaceId: null,
				mode: AutomationMode.RESTART,
				graph: { version: 1, nodes: [], edges: [] },
				revision: 1,
				status: AutomationStatus.OK,
				lastTriggeredAt: null,
				lastRunStatus: null,
			});
			expect(automation.id).toEqual(expect.any(String));
			expect(automation.createdAt).toBeInstanceOf(Date);
		});

		it('stores every provided field and keeps the node configuration exactly as submitted', async () => {
			const automation = await create({
				id: '0b0f3f52-55d6-4b2f-9d8e-3f8b9b6f6a10',
				name: 'Motion light',
				description: 'Hallway',
				icon: 'mdi:motion-sensor',
				enabled: true,
				space_id: SPACE_ID,
				mode: AutomationMode.PARALLEL,
				graph: graph(),
			});

			expect(automation).toMatchObject({
				id: '0b0f3f52-55d6-4b2f-9d8e-3f8b9b6f6a10',
				description: 'Hallway',
				icon: 'mdi:motion-sensor',
				enabled: true,
				spaceId: SPACE_ID,
				mode: AutomationMode.PARALLEL,
			});
			expect(automation.graph).toEqual(graph());
			expect((await service.getOneOrThrow(automation.id)).graph).toEqual(graph());
		});

		it('emits the created automation, graph included', async () => {
			const automation = await create({ name: 'Motion light', graph: graph() });

			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.AUTOMATION_CREATED, automation);
			expect((eventEmitter.emit.mock.calls[0] as [string, AutomationEntity])[1].graph).toEqual(graph());
		});

		it('refuses a space that does not exist and stores nothing', async () => {
			await expect(create({ name: 'Motion light', space_id: OTHER_SPACE_ID })).rejects.toBeInstanceOf(
				AutomationsSpaceValidationException,
			);

			expect(await repository.count()).toBe(0);
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('refuses an identifier that is already taken instead of overwriting the automation', async () => {
			const existing = await create({ name: 'Motion light' });

			await expect(create({ id: existing.id, name: 'Impostor' })).rejects.toBeInstanceOf(
				AutomationsValidationException,
			);

			expect((await service.getOneOrThrow(existing.id)).name).toBe('Motion light');
		});

		it.each([
			['a missing name', {}],
			['an empty name', { name: '' }],
			['an overlong name', { name: 'x'.repeat(101) }],
			['an unknown mode', { name: 'A', mode: 'queued' }],
			['an unknown property', { name: 'A', status: 'suspended' }],
			['a client supplied revision', { name: 'A', revision: 7 }],
		])('refuses %s', async (_label, data) => {
			await expect(create(data)).rejects.toBeInstanceOf(AutomationsValidationException);

			expect(await repository.count()).toBe(0);
		});
	});

	describe('graph shape validation', () => {
		const manyNodes = (count: number) => Array.from({ length: count }, (_, index) => node(`n${index}`));

		it.each([
			['a graph version other than 1', { ...graph(), version: 2 }],
			['a missing version', { nodes: [], edges: [] }],
			['missing nodes', { version: 1, edges: [] }],
			['missing edges', { version: 1, nodes: [] }],
			['duplicate node ids', { version: 1, nodes: [node('n1'), node('n1')], edges: [] }],
			[
				'duplicate edge ids',
				{ version: 1, nodes: [node('n1'), node('n2')], edges: [edge('e1', 'n1', 'n2'), edge('e1', 'n2', 'n1')] },
			],
			['an edge from an unknown node', { version: 1, nodes: [node('n1')], edges: [edge('e1', 'ghost', 'n1')] }],
			['an edge to an unknown node', { version: 1, nodes: [node('n1')], edges: [edge('e1', 'n1', 'ghost')] }],
			['an empty node id', { version: 1, nodes: [node('')], edges: [] }],
			['an overlong node id', { version: 1, nodes: [node('n'.repeat(65))], edges: [] }],
			['an overlong node type', { version: 1, nodes: [{ ...node('n1'), type: 't'.repeat(101) }], edges: [] }],
			['a node without a position', { version: 1, nodes: [{ id: 'n1', type: 't', config: {} }], edges: [] }],
			['a non-numeric position', { version: 1, nodes: [{ ...node('n1'), position: { x: 'left', y: 0 } }], edges: [] }],
			[
				'a node without a config',
				{ version: 1, nodes: [{ id: 'n1', type: 't', position: { x: 0, y: 0 } }], edges: [] },
			],
			['a config that is not an object', { version: 1, nodes: [{ ...node('n1'), config: 'on' }], edges: [] }],
			['an unknown node property', { version: 1, nodes: [{ ...node('n1'), label: 'x' }], edges: [] }],
			[
				'an edge without ports',
				{ version: 1, nodes: [node('n1'), node('n2')], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] },
			],
			['an unknown graph property', { ...graph(), viewport: { zoom: 1 } }],
			['more nodes than allowed', { version: 1, nodes: manyNodes(AUTOMATION_GRAPH_MAX_NODES + 1), edges: [] }],
			[
				'more edges than allowed',
				{
					version: 1,
					nodes: [node('n1'), node('n2')],
					edges: Array.from({ length: AUTOMATION_GRAPH_MAX_EDGES + 1 }, (_, index) => edge(`e${index}`, 'n1', 'n2')),
				},
			],
			['a graph that is not an object', 'graph'],
		])('refuses %s on create and on update', async (_label, invalidGraph) => {
			await expect(create({ name: 'A', graph: invalidGraph })).rejects.toBeInstanceOf(AutomationsValidationException);

			const automation = await create({ name: 'A', graph: graph() });

			await expect(update(automation.id, { revision: 1, graph: invalidGraph })).rejects.toBeInstanceOf(
				AutomationsValidationException,
			);

			const stored = await service.getOneOrThrow(automation.id);

			expect(stored.revision).toBe(1);
			expect(stored.graph).toEqual(graph());
		});

		it('names the dangling edge in the validation message', async () => {
			await expect(
				create({ name: 'A', graph: { version: 1, nodes: [node('n1')], edges: [edge('e-lost', 'n1', 'ghost')] } }),
			).rejects.toThrow(/e-lost/);
		});

		it('accepts a graph at the node limit', async () => {
			const automation = await create({
				name: 'A',
				graph: { version: 1, nodes: manyNodes(AUTOMATION_GRAPH_MAX_NODES), edges: [] },
			});

			expect(automation.graph.nodes).toHaveLength(AUTOMATION_GRAPH_MAX_NODES);
		});
	});

	describe('graph validation against the node types', () => {
		const trigger = (id: string) => node(id, {}, FAKE_TRIGGER_TYPE);
		const strict = (id: string, config: Record<string, unknown>) => node(id, config, FAKE_STRICT_ACTION_TYPE);

		const complete = () => ({
			version: 1,
			nodes: [trigger('t'), strict('a', { level: 40 })],
			edges: [edge('e1', 't', 'a')],
		});

		// Drawn correctly but not finished: one node is not configured and one is not wired yet
		const draft = () => ({
			version: 1,
			nodes: [trigger('t'), strict('a', { level: 250 }), node('later')],
			edges: [edge('e1', 't', 'a')],
		});

		const structurallyBroken: Array<[string, string, Record<string, unknown>]> = [
			[
				'an unknown node type',
				'unknown_node_type',
				{ version: 1, nodes: [node('x', {}, 'not.registered')], edges: [] },
			],
			[
				'an unknown port',
				'unknown_port',
				{ version: 1, nodes: [trigger('t'), node('a')], edges: [{ ...edge('e1', 't', 'a'), source_port: 'yes' }] },
			],
			[
				'an edge into a trigger',
				'edge_into_trigger',
				{ version: 1, nodes: [trigger('t1'), trigger('t2')], edges: [edge('e1', 't1', 't2')] },
			],
			[
				'a cycle',
				'cycle',
				{
					version: 1,
					nodes: [trigger('t'), node('a'), node('b')],
					edges: [
						edge('e1', 't', 'a'),
						{ ...edge('e2', 'a', 'b'), source_port: 'done' },
						{ ...edge('e3', 'b', 'a'), source_port: 'done' },
					],
				},
			],
			[
				'a duplicate edge',
				'duplicate_edge',
				{ version: 1, nodes: [trigger('t'), node('a')], edges: [edge('e1', 't', 'a'), edge('e2', 't', 'a')] },
			],
		];

		const rejection = async (attempt: Promise<unknown>): Promise<AutomationsGraphValidationException> => {
			const error: unknown = await attempt.then(
				() => undefined,
				(reason: unknown) => reason,
			);

			expect(error).toBeInstanceOf(AutomationsGraphValidationException);
			// The controller answers every validation exception with 422
			expect(error).toBeInstanceOf(AutomationsValidationException);

			return error as AutomationsGraphValidationException;
		};

		describe('create', () => {
			it.each(structurallyBroken)('refuses %s even on a disabled automation', async (_label, code, brokenGraph) => {
				const error = await rejection(create({ name: 'A', graph: brokenGraph }));

				expect(error.issues.filter((issue) => issue.blocking).map((issue) => issue.code)).toEqual([code]);
				expect(await repository.count()).toBe(0);
				expect(eventEmitter.emit).not.toHaveBeenCalled();
			});

			it('stores an empty graph on a disabled automation', async () => {
				expect((await create({ name: 'A' })).graph.nodes).toEqual([]);
				expect((await create({ name: 'B', enabled: false, graph: { version: 1, nodes: [], edges: [] } })).enabled).toBe(
					false,
				);
			});

			it('refuses an enabled automation without a graph, as it has no trigger', async () => {
				const error = await rejection(create({ name: 'A', enabled: true }));

				expect(error.issues).toEqual([
					expect.objectContaining({ code: 'no_trigger', severity: 'error', blocking: true }),
				]);
				expect(await repository.count()).toBe(0);
			});

			it('stores a half-drawn, half-configured graph as a disabled draft', async () => {
				const automation = await create({ name: 'A', graph: draft() });

				expect(automation.enabled).toBe(false);
				expect(automation.graph).toEqual(draft());
			});

			it('refuses the same draft on an enabled automation and tells which node is not configured', async () => {
				const error = await rejection(create({ name: 'A', enabled: true, graph: draft() }));

				expect(error.issues.map((issue) => [issue.code, issue.node_id, issue.blocking])).toEqual([
					['invalid_config', 'a', true],
					['unreachable_node', 'later', false],
				]);
				expect(error.issues[0]).toMatchObject({ field: 'level', message: 'Level must be between 0 and 100.' });
				expect(await repository.count()).toBe(0);
			});

			it('stores a complete graph on an enabled automation, warnings included', async () => {
				const withOrphan = { ...complete(), nodes: [...complete().nodes, node('later')] };

				expect((await create({ name: 'A', enabled: true, graph: complete() })).enabled).toBe(true);
				expect((await create({ name: 'B', enabled: true, graph: withOrphan })).graph).toEqual(withOrphan);
			});

			it('does not put the submitted configuration into the message or the log', async () => {
				const logged: string[] = [];
				const logger = (service as unknown as { logger: Record<string, (message: string) => void> }).logger;

				for (const level of ['error', 'warn', 'log', 'debug']) {
					jest.spyOn(logger, level).mockImplementation((message: string) => {
						logged.push(message);
					});
				}

				const leaky = {
					...complete(),
					nodes: [trigger('t'), strict('a', { level: 'secret-value', note: 'secret-value' })],
				};

				const error = await rejection(create({ name: 'A', enabled: true, graph: leaky }));

				expect(error.issues.length).toBeGreaterThan(1);
				expect(logged.join('\n')).toContain(`${error.issues.length} blocking issue(s)`);
				expect(logged.join('\n')).not.toContain('secret-value');
				expect(error.message).not.toContain('secret-value');
				expect(JSON.stringify(error.issues)).not.toContain('secret-value');
			});
		});

		describe('update', () => {
			it.each(structurallyBroken)('refuses %s and changes nothing', async (_label, code, brokenGraph) => {
				const automation = await create({ name: 'A', graph: complete() });

				eventEmitter.emit.mockClear();

				const error = await rejection(update(automation.id, { revision: 1, name: 'Renamed', graph: brokenGraph }));

				expect(error.issues.filter((issue) => issue.blocking).map((issue) => issue.code)).toEqual([code]);

				const stored = await service.getOneOrThrow(automation.id);

				expect(stored).toMatchObject({ name: 'A', revision: 1 });
				expect(stored.graph).toEqual(complete());
				expect(eventEmitter.emit).not.toHaveBeenCalled();
			});

			it('stores a draft on a disabled automation', async () => {
				const automation = await create({ name: 'A', graph: complete() });

				expect((await update(automation.id, { revision: 1, graph: draft() })).graph).toEqual(draft());
			});

			it('refuses a draft submitted for an enabled automation', async () => {
				const automation = await create({ name: 'A', enabled: true, graph: complete() });

				await rejection(update(automation.id, { revision: 1, graph: draft() }));

				expect((await service.getOneOrThrow(automation.id)).graph).toEqual(complete());
			});

			it('stores a draft submitted together with switching the automation off', async () => {
				const automation = await create({ name: 'A', enabled: true, graph: complete() });

				const updated = await update(automation.id, { revision: 1, enabled: false, graph: draft() });

				expect(updated).toMatchObject({ enabled: false, revision: 2 });
				expect(updated.graph).toEqual(draft());
			});

			it('refuses a draft submitted together with switching the automation on', async () => {
				const automation = await create({ name: 'A', graph: complete() });

				await rejection(update(automation.id, { revision: 1, enabled: true, graph: draft() }));

				expect(await service.getOneOrThrow(automation.id)).toMatchObject({ enabled: false, revision: 1 });
			});

			it('refuses to enable an automation whose stored graph is a draft', async () => {
				const automation = await create({ name: 'A', graph: draft() });

				const error = await rejection(update(automation.id, { revision: 1, enabled: true }));

				expect(error.issues.filter((issue) => issue.blocking).map((issue) => [issue.code, issue.node_id])).toEqual([
					['invalid_config', 'a'],
				]);
				expect(await service.getOneOrThrow(automation.id)).toMatchObject({ enabled: false, revision: 1 });
			});

			it('refuses to enable an automation whose stored graph is empty', async () => {
				const automation = await create({ name: 'A' });

				const error = await rejection(update(automation.id, { revision: 1, enabled: true }));

				expect(error.issues.map((issue) => issue.code)).toEqual(['no_trigger']);
			});

			it('enables an automation whose stored graph is complete', async () => {
				const automation = await create({ name: 'A', graph: complete() });

				expect((await update(automation.id, { revision: 1, enabled: true })).enabled).toBe(true);
			});

			it('enables an automation together with the graph that completes it', async () => {
				const automation = await create({ name: 'A', graph: draft() });

				const updated = await update(automation.id, { revision: 1, enabled: true, graph: complete() });

				expect(updated.enabled).toBe(true);
				expect(updated.graph).toEqual(complete());
			});

			it('reports a stale revision before it looks at the graph', async () => {
				const automation = await create({ name: 'A', graph: complete() });

				await expect(update(automation.id, { revision: 7, graph: structurallyBroken[0][2] })).rejects.toBeInstanceOf(
					AutomationsRevisionConflictException,
				);
			});

			describe('when a node type has gone since the graph was stored', () => {
				let automationId: string;

				beforeEach(async () => {
					automationId = (await create({ name: 'A', enabled: true, graph: complete() })).id;

					// A registry without the strict action, as after its plugin was removed
					const smaller = new AutomationNodeTypeRegistryService();

					for (const nodeType of FAKE_NODE_TYPES.filter((item) => item.type !== FAKE_STRICT_ACTION_TYPE)) {
						smaller.register(nodeType);
					}

					service = new AutomationsService(
						repository,
						spacesService as unknown as SpacesService,
						eventEmitter as unknown as EventEmitter2,
						smaller,
					);
				});

				it('still lets the automation be renamed and switched off', async () => {
					const renamed = await update(automationId, { revision: 1, name: 'Renamed' });
					const disabled = await update(automationId, { revision: 2, enabled: false });

					expect(renamed.name).toBe('Renamed');
					expect(disabled.enabled).toBe(false);
				});

				it('does not let it be switched back on or its graph be saved again unchanged', async () => {
					await update(automationId, { revision: 1, enabled: false });

					const enabling = await rejection(update(automationId, { revision: 2, enabled: true }));
					const saving = await rejection(update(automationId, { revision: 2, graph: complete() }));

					expect(enabling.issues.map((issue) => issue.code)).toEqual(['unknown_node_type']);
					expect(saving.issues.map((issue) => issue.code)).toEqual(['unknown_node_type']);
				});
			});
		});

		describe('checkGraph', () => {
			it('validates without storing anything', async () => {
				expect(await service.checkGraph(complete(), true)).toEqual({ valid: true, issues: [] });
				expect((await service.checkGraph(draft(), false)).valid).toBe(true);
				expect((await service.checkGraph(draft(), true)).valid).toBe(false);
				expect(await repository.count()).toBe(0);
			});
		});
	});

	describe('findAll', () => {
		it('lists automations by name without their graphs', async () => {
			await create({ name: 'Zulu', graph: graph() });
			await create({ name: 'Alpha', graph: graph(), space_id: SPACE_ID });

			const automations = await service.findAll();

			expect(automations.map((automation) => automation.name)).toEqual(['Alpha', 'Zulu']);
			expect(automations[0]).toMatchObject({
				enabled: false,
				spaceId: SPACE_ID,
				mode: AutomationMode.RESTART,
				revision: 1,
				status: AutomationStatus.OK,
				lastTriggeredAt: null,
				lastRunStatus: null,
			});
			expect(automations[0].createdAt).toBeInstanceOf(Date);

			for (const automation of automations) {
				expect(automation).not.toBeInstanceOf(AutomationEntity);
				expect(automation).not.toHaveProperty('graph');
			}
		});
	});

	describe('update', () => {
		it('changes only the provided fields and increments the revision', async () => {
			const automation = await create({ name: 'Motion light', description: 'Hallway', graph: graph() });

			const updated = await update(automation.id, { revision: 1, name: 'Renamed', enabled: true });

			expect(updated).toMatchObject({
				name: 'Renamed',
				description: 'Hallway',
				enabled: true,
				revision: 2,
			});
			expect(updated.graph).toEqual(graph());
			expect(updated.updatedAt).toBeInstanceOf(Date);
		});

		it('replaces the graph as a whole', async () => {
			const automation = await create({ name: 'Motion light', graph: graph() });
			const nextGraph = { version: 1, nodes: [node('only', { camelCase: 1 }, FAKE_TRIGGER_TYPE)], edges: [] };

			const updated = await update(automation.id, { revision: 1, graph: nextGraph });

			expect(updated.graph).toEqual(nextGraph);
			expect(updated.revision).toBe(2);
		});

		it('clears nullable fields with null and leaves them alone when they are absent', async () => {
			const automation = await create({
				name: 'Motion light',
				description: 'Hallway',
				icon: 'mdi:motion-sensor',
				space_id: SPACE_ID,
			});

			const cleared = await update(automation.id, { revision: 1, description: null, space_id: null });

			expect(cleared).toMatchObject({ description: null, spaceId: null, icon: 'mdi:motion-sensor', revision: 2 });
		});

		it('increments the revision even when nothing else changes', async () => {
			const automation = await create({ name: 'Motion light' });

			await update(automation.id, { revision: 1 });
			const updated = await update(automation.id, { revision: 2 });

			expect(updated.revision).toBe(3);
		});

		it('resumes an automation the overload guard suspended, whatever the save changes', async () => {
			const automation = await create({ name: 'Motion light', graph: graph() });

			await repository.update({ id: automation.id }, { status: AutomationStatus.SUSPENDED });

			const updated = await update(automation.id, { revision: 1, name: 'Renamed' });

			expect(updated.status).toBe(AutomationStatus.OK);
		});

		it('leaves an invalid status to the engine', async () => {
			const automation = await create({ name: 'Motion light', graph: graph() });

			await repository.update({ id: automation.id }, { status: AutomationStatus.INVALID });

			const updated = await update(automation.id, { revision: 1, name: 'Renamed' });

			expect(updated.status).toBe(AutomationStatus.INVALID);
		});

		it('emits the updated automation, graph included', async () => {
			const automation = await create({ name: 'Motion light', graph: graph() });
			eventEmitter.emit.mockClear();

			const updated = await update(automation.id, { revision: 1, name: 'Renamed' });

			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.AUTOMATION_UPDATED, updated);
			expect((eventEmitter.emit.mock.calls[0] as [string, AutomationEntity])[1]).toMatchObject({
				revision: 2,
				graph: graph(),
			});
		});

		it('refuses a stale revision and changes nothing', async () => {
			const automation = await create({ name: 'Motion light' });
			await update(automation.id, { revision: 1, name: 'First editor' });
			eventEmitter.emit.mockClear();

			await expect(update(automation.id, { revision: 1, name: 'Second editor' })).rejects.toBeInstanceOf(
				AutomationsRevisionConflictException,
			);

			expect(await service.getOneOrThrow(automation.id)).toMatchObject({ name: 'First editor', revision: 2 });
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('refuses a revision from the future', async () => {
			const automation = await create({ name: 'Motion light' });

			await expect(update(automation.id, { revision: 5, name: 'Renamed' })).rejects.toBeInstanceOf(
				AutomationsRevisionConflictException,
			);
		});

		it('lets exactly one of two concurrent updates based on the same revision through', async () => {
			const automation = await create({ name: 'Motion light' });
			eventEmitter.emit.mockClear();

			const results = await Promise.allSettled([
				update(automation.id, { revision: 1, name: 'First editor' }),
				update(automation.id, { revision: 1, name: 'Second editor' }),
			]);

			expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
			expect(results.find((result) => result.status === 'rejected').reason).toBeInstanceOf(
				AutomationsRevisionConflictException,
			);
			expect((await service.getOneOrThrow(automation.id)).revision).toBe(2);
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
		});

		it('reports a conflict when the row moved on between the read and the write', async () => {
			const automation = await create({ name: 'Motion light' });
			const findOne = jest.spyOn(service, 'findOne');

			// The service reads revision 1, then somebody else saves before the conditional UPDATE runs
			findOne.mockImplementationOnce(async (id: string) => {
				const stale = await repository.findOneByOrFail({ id });
				await repository.update({ id }, { revision: 2, name: 'Somebody else' });

				return stale;
			});

			await expect(update(automation.id, { revision: 1, name: 'Mine' })).rejects.toBeInstanceOf(
				AutomationsRevisionConflictException,
			);

			expect(await repository.findOneByOrFail({ id: automation.id })).toMatchObject({
				name: 'Somebody else',
				revision: 2,
			});
		});

		it('reports not found when the row was deleted between the read and the write', async () => {
			const automation = await create({ name: 'Motion light' });

			jest.spyOn(service, 'findOne').mockImplementationOnce(async (id: string) => {
				const stale = await repository.findOneByOrFail({ id });
				await repository.delete({ id });

				return stale;
			});

			await expect(update(automation.id, { revision: 1, name: 'Mine' })).rejects.toBeInstanceOf(
				AutomationsNotFoundException,
			);
		});

		it('requires the revision', async () => {
			const automation = await create({ name: 'Motion light' });

			await expect(update(automation.id, { name: 'Renamed' })).rejects.toBeInstanceOf(AutomationsValidationException);
			await expect(update(automation.id, { revision: 0, name: 'Renamed' })).rejects.toBeInstanceOf(
				AutomationsValidationException,
			);
		});

		it.each([
			['status', { status: 'suspended' }],
			['last_run_status', { last_run_status: 'failed' }],
			['last_triggered_at', { last_triggered_at: '2026-01-01T00:00:00Z' }],
			['id', { id: MISSING_ID }],
		])('does not let a client write %s', async (_label, data) => {
			const automation = await create({ name: 'Motion light' });

			await expect(update(automation.id, { revision: 1, ...data })).rejects.toBeInstanceOf(
				AutomationsValidationException,
			);
		});

		it('refuses a new space that does not exist', async () => {
			const automation = await create({ name: 'Motion light' });

			await expect(update(automation.id, { revision: 1, space_id: OTHER_SPACE_ID })).rejects.toBeInstanceOf(
				AutomationsSpaceValidationException,
			);

			expect((await service.getOneOrThrow(automation.id)).revision).toBe(1);
		});

		it('still saves an automation whose unchanged space has been deleted since', async () => {
			const automation = await create({ name: 'Motion light', space_id: SPACE_ID });
			spacesService.findOne.mockResolvedValue(null);

			const updated = await update(automation.id, { revision: 1, name: 'Renamed', space_id: SPACE_ID });

			expect(updated).toMatchObject({ name: 'Renamed', spaceId: SPACE_ID, revision: 2 });
		});

		it('reports an unknown automation as not found', async () => {
			await expect(update(MISSING_ID, { revision: 1, name: 'Renamed' })).rejects.toBeInstanceOf(
				AutomationsNotFoundException,
			);
		});
	});

	describe('remove', () => {
		it('deletes the automation and emits its id', async () => {
			const automation = await create({ name: 'Motion light' });
			eventEmitter.emit.mockClear();

			await service.remove(automation.id);

			expect(await service.findOne(automation.id)).toBeNull();
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.AUTOMATION_DELETED, { id: automation.id });
		});

		it('reports an unknown automation as not found', async () => {
			await expect(service.remove(MISSING_ID)).rejects.toBeInstanceOf(AutomationsNotFoundException);

			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});
});
