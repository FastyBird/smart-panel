/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { AutomationNodeTypeRegistryService } from '../src/modules/automations/services/node-type-registry.service';
import {
	FAKE_ACTION_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_CONFIG_SCHEMA,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../src/modules/automations/testing/fake-node-types';
import { UserRole } from '../src/modules/users/users.constants';

interface AutomationBody {
	id: string;
	name: string;
	description: string | null;
	icon: string | null;
	enabled: boolean;
	space_id: string | null;
	mode: string;
	graph?: unknown;
	revision: number;
	status: string;
	last_triggered_at: string | null;
	last_run_status: string | null;
	created_at: string;
	updated_at: string | null;
}

interface IssueBody {
	severity: string;
	code: string;
	message: string;
	blocking: boolean;
	node_id?: string;
	edge_id?: string;
	node_ids?: string[];
	field?: string;
}

// A refused graph as the controller throws it. The error envelope filters are installed in src/main.ts, not in
// this test application; in production the 422 filter moves these into error.details (reason, code, issues),
// which unprocessable-entity-exception.filter.spec.ts covers.
interface GraphRejectionBody {
	code: string;
	message: string;
	issues: IssueBody[];
}

interface NodeTypeBody {
	type: string;
	kind: string;
	name: string;
	description: string;
	ports: { inputs: string[]; outputs: string[] };
	config_schema: Record<string, unknown>;
}

describe('Automations module (e2e)', () => {
	let app: INestApplication;
	let ownerToken: string;
	let adminToken: string;
	let userToken: string;
	let displayToken: string;

	const base = '/modules/automations/automations';
	const nodeTypesBase = '/modules/automations/node-types';

	// Guards run before the route handler even looks the id up, so a well-formed but
	// non-existent id is enough to prove the role denial happens before anything else.
	const placeholderId = '11111111-1111-4111-8111-111111111111';

	const graph = {
		version: 1,
		nodes: [
			{
				id: 'n1',
				type: FAKE_TRIGGER_TYPE,
				position: { x: 40, y: 80 },
				// Mixed-case keys and nested values: the configuration is opaque and must come back untouched
				config: { property_id: 'p-1', camelCaseKey: true, nested: { list: [1, 'two', { three: 3 }] } },
			},
			{ id: 'n2', type: FAKE_ACTION_TYPE, position: { x: 320.5, y: -80 }, config: {} },
		],
		edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
	};

	// Drawn correctly but not finished: the strict action is not configured and one node is not wired yet
	const draftGraph = {
		version: 1,
		nodes: [
			{ id: 't', type: FAKE_TRIGGER_TYPE, position: { x: 0, y: 0 }, config: {} },
			{ id: 'a', type: FAKE_STRICT_ACTION_TYPE, position: { x: 200, y: 0 }, config: { level: 250 } },
			{ id: 'later', type: FAKE_ACTION_TYPE, position: { x: 400, y: 0 }, config: {} },
		],
		edges: [{ id: 'e1', source: 't', source_port: 'out', target: 'a', target_port: 'in' }],
	};

	const completeGraph = {
		...draftGraph,
		nodes: [draftGraph.nodes[0], { ...draftGraph.nodes[1], config: { level: 40 } }],
	};

	// Could never run: an edge on a port the trigger does not have
	const brokenGraph = { ...completeGraph, edges: [{ ...completeGraph.edges[0], source_port: 'yes' }] };

	const login = async (username: string): Promise<string> => {
		const response = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username, password: 'securePassword123!' } });

		return (response.body as { data: { access_token: string } }).data.access_token;
	};

	const createUser = async (username: string, role: UserRole): Promise<string> => {
		await request(app.getHttpServer())
			.post('/modules/users/users')
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { username, password: 'securePassword123!', email: `${username}@example.com`, role } })
			.expect(201);

		return login(username);
	};

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [dynamicAppModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		// The same pipe as src/main.ts
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: {
					enableImplicitConversion: true,
				},
				exceptionFactory: (validationErrors) => ValidationExceptionFactory.createException(validationErrors),
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// No concrete node type ships with the module yet, so the tests register fake ones the way a module
		// or plugin registers its own from onModuleInit
		const nodeTypeRegistry = app.get(AutomationNodeTypeRegistryService, { strict: false });

		for (const nodeType of FAKE_NODE_TYPES) {
			nodeTypeRegistry.register(nodeType);
		}

		// Wait for all modules to initialize (especially module mappings)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// /auth/register only ever succeeds once - it creates the application owner and
		// 403s on every later call - so the first registered account becomes owner.
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'autoowner', password: 'securePassword123!', email: 'autoowner@example.com' } });

		ownerToken = await login('autoowner');
		adminToken = await createUser('autoadmin', UserRole.ADMIN);
		userToken = await createUser('autouser', UserRole.USER);

		// Displays self-register without any auth and get their own access token back.
		const displayRegister = await request(app.getHttpServer())
			.post('/modules/displays/register')
			.set('User-Agent', 'FastyBird Smart Panel')
			.send({
				data: {
					mac_address: '00:1A:2B:3C:4D:6A',
					version: '1.0.0',
					build: '42',
					screen_width: 1920,
					screen_height: 1080,
					pixel_ratio: 1.5,
				},
			});

		displayToken = (displayRegister.body as { data: { access_token: string } }).data.access_token;

		expect(ownerToken).toEqual(expect.any(String));
		expect(adminToken).toEqual(expect.any(String));
		expect(userToken).toEqual(expect.any(String));
		expect(displayToken).toEqual(expect.any(String));
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	describe('as owner', () => {
		it('creates, lists without the graph, reads with the graph, updates, refuses a stale revision and deletes', async () => {
			// Create
			const created = await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { name: 'Hallway motion light', description: 'Night light', graph } })
				.expect(201);

			const automation = (created.body as { data: AutomationBody }).data;

			expect(automation).toMatchObject({
				name: 'Hallway motion light',
				description: 'Night light',
				icon: null,
				enabled: false,
				space_id: null,
				mode: 'restart',
				revision: 1,
				status: 'ok',
				last_triggered_at: null,
				last_run_status: null,
			});
			expect(automation.graph).toEqual(graph);
			// setLocationHeader() is shared by every module and builds the path without the /modules segment
			expect(created.headers.location).toContain(`/automations/automations/${automation.id}`);

			// List: metadata only
			const list = await request(app.getHttpServer())
				.get(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			const listed = (list.body as { data: AutomationBody[] }).data.find((row) => row.id === automation.id);

			expect(listed).toMatchObject({
				id: automation.id,
				name: 'Hallway motion light',
				enabled: false,
				space_id: null,
				mode: 'restart',
				revision: 1,
				status: 'ok',
				created_at: automation.created_at,
			});
			expect(listed).not.toHaveProperty('graph');

			// Detail: with the graph
			const detail = await request(app.getHttpServer())
				.get(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			expect((detail.body as { data: AutomationBody }).data.graph).toEqual(graph);

			// Update based on the current revision
			const nextGraph = { ...graph, nodes: [...graph.nodes, { ...graph.nodes[1], id: 'n3' }] };

			const updated = await request(app.getHttpServer())
				.patch(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { revision: 1, name: 'Renamed', enabled: true, mode: 'single', graph: nextGraph } })
				.expect(200);

			expect((updated.body as { data: AutomationBody }).data).toMatchObject({
				id: automation.id,
				name: 'Renamed',
				description: 'Night light',
				enabled: true,
				mode: 'single',
				revision: 2,
				graph: nextGraph,
			});

			// A second editor still holding revision 1 is refused and changes nothing
			const conflict = await request(app.getHttpServer())
				.patch(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { revision: 1, name: 'Stale edit' } })
				.expect(409);

			// The error envelope filters are installed in src/main.ts, not in this test application
			expect(conflict.body).toMatchObject({ statusCode: 409, error: 'Conflict' });

			const afterConflict = await request(app.getHttpServer())
				.get(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			expect((afterConflict.body as { data: AutomationBody }).data).toMatchObject({
				name: 'Renamed',
				revision: 2,
				graph: nextGraph,
			});

			// Delete
			await request(app.getHttpServer())
				.delete(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(204);

			await request(app.getHttpServer())
				.get(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(404);

			await request(app.getHttpServer())
				.patch(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { revision: 2, name: 'Gone' } })
				.expect(404);

			await request(app.getHttpServer())
				.delete(`${base}/${automation.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(404);
		});

		it('creates an automation with an empty graph when none is given', async () => {
			const created = await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { name: 'Empty' } })
				.expect(201);

			expect((created.body as { data: AutomationBody }).data.graph).toEqual({ version: 1, nodes: [], edges: [] });
		});

		it.each([
			['a missing name', { graph }],
			['an unknown property', { name: 'A', status: 'suspended' }],
			['a graph version other than 1', { name: 'A', graph: { ...graph, version: 2 } }],
			['duplicate node ids', { name: 'A', graph: { ...graph, nodes: [graph.nodes[0], graph.nodes[0]], edges: [] } }],
			['duplicate edge ids', { name: 'A', graph: { ...graph, edges: [graph.edges[0], graph.edges[0]] } }],
			[
				'an edge to an unknown node',
				{ name: 'A', graph: { ...graph, edges: [{ ...graph.edges[0], target: 'ghost' }] } },
			],
			[
				'an unknown node property',
				{ name: 'A', graph: { ...graph, nodes: [{ ...graph.nodes[0], label: 'x' }, graph.nodes[1]] } },
			],
		])('rejects %s with 400', async (_label, data) => {
			await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data })
				.expect(400);
		});

		it('rejects an update without a revision with 400', async () => {
			const created = await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { name: 'Needs a revision' } })
				.expect(201);

			await request(app.getHttpServer())
				.patch(`${base}/${(created.body as { data: AutomationBody }).data.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { name: 'Renamed' } })
				.expect(400);
		});

		it('rejects a space that does not exist with 422', async () => {
			await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { name: 'Lost in space', space_id: placeholderId } })
				.expect(422);
		});
	});

	describe('node type catalogue', () => {
		it('lists the registered node types with their ports and config schema, ordered by type', async () => {
			const response = await request(app.getHttpServer())
				.get(nodeTypesBase)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			const nodeTypes = (response.body as { data: NodeTypeBody[] }).data.filter((item) =>
				item.type.startsWith('test.'),
			);

			expect(nodeTypes.map((item) => item.type)).toEqual([
				'test.action',
				'test.condition',
				'test.join',
				'test.strict-action',
				'test.trigger',
			]);
			expect(nodeTypes.find((item) => item.type === 'test.trigger')).toEqual({
				type: 'test.trigger',
				kind: 'trigger',
				name: 'Test trigger',
				description: 'Starts a run in tests.',
				ports: { inputs: [], outputs: ['out'] },
				// A node type that does not describe its configuration accepts any object
				config_schema: { type: 'object', additionalProperties: true },
			});
			expect(nodeTypes.find((item) => item.type === 'test.condition')?.ports).toEqual({
				inputs: ['in'],
				outputs: ['yes', 'no'],
			});
			expect(nodeTypes.find((item) => item.type === 'test.join')).toMatchObject({
				kind: 'flow',
				ports: { inputs: ['a', 'b'], outputs: ['out'] },
			});
			// The schema is served as the node type wrote it: its keys are not rewritten
			expect(nodeTypes.find((item) => item.type === 'test.strict-action')).toMatchObject({
				kind: 'action',
				ports: { inputs: ['in'], outputs: ['done', 'error'] },
				config_schema: FAKE_STRICT_ACTION_CONFIG_SCHEMA,
			});
		});
	});

	describe('graph validation', () => {
		const validate = (data: Record<string, unknown>) =>
			request(app.getHttpServer()).post(`${base}/validate`).set('Authorization', `Bearer ${ownerToken}`).send({ data });

		const countAutomations = async (): Promise<number> => {
			const list = await request(app.getHttpServer())
				.get(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			return (list.body as { data: AutomationBody[] }).data.length;
		};

		describe('POST /automations/validate', () => {
			it('finds nothing in a complete graph and saves nothing', async () => {
				const before = await countAutomations();

				const response = await validate({ graph: completeGraph, enabled: true }).expect(200);

				expect((response.body as { data: unknown }).data).toEqual({ valid: true, issues: [] });
				expect(await countAutomations()).toBe(before);
			});

			it('lists the issues of a draft per node and takes it for a disabled automation unless told otherwise', async () => {
				const expected = (blocking: boolean) => [
					{
						severity: 'error',
						code: 'invalid_config',
						message: 'Level must be between 0 and 100.',
						node_id: 'a',
						field: 'level',
						blocking,
					},
					{
						severity: 'warning',
						code: 'unreachable_node',
						message: 'No trigger leads to this node, so it never runs.',
						node_id: 'later',
						blocking: false,
					},
				];

				const asDraft = await validate({ graph: draftGraph }).expect(200);
				const asDisabled = await validate({ graph: draftGraph, enabled: false }).expect(200);
				const asEnabled = await validate({ graph: draftGraph, enabled: true }).expect(200);

				expect((asDraft.body as { data: unknown }).data).toEqual({ valid: true, issues: expected(false) });
				expect((asDisabled.body as { data: unknown }).data).toEqual({ valid: true, issues: expected(false) });
				expect((asEnabled.body as { data: unknown }).data).toEqual({ valid: false, issues: expected(true) });
			});

			it('reports structural problems as invalid whatever the enabled flag, with the edge and the nodes', async () => {
				const cyclic = {
					version: 1,
					nodes: [
						draftGraph.nodes[0],
						{ ...draftGraph.nodes[2], id: 'x' },
						{ ...draftGraph.nodes[2], id: 'y' },
						{ ...draftGraph.nodes[2], id: 'ghost', type: 'not.registered' },
					],
					edges: [
						{ id: 'e1', source: 't', source_port: 'out', target: 'x', target_port: 'in' },
						{ id: 'e2', source: 'x', source_port: 'done', target: 'y', target_port: 'in' },
						{ id: 'e3', source: 'y', source_port: 'done', target: 'x', target_port: 'in' },
						{ id: 'e4', source: 'y', source_port: 'done', target: 'x', target_port: 'in' },
						{ id: 'e5', source: 'x', source_port: 'error', target: 't', target_port: 'in' },
						{ id: 'e6', source: 't', source_port: 'sideways', target: 'y', target_port: 'in' },
					],
				};

				const response = await validate({ graph: cyclic, enabled: false }).expect(200);
				const { valid, issues } = (response.body as { data: { valid: boolean; issues: IssueBody[] } }).data;

				expect(valid).toBe(false);
				expect(issues.every((issue) => issue.blocking && issue.severity === 'error')).toBe(true);
				expect(issues.map(({ code, node_id, edge_id, node_ids }) => ({ code, node_id, edge_id, node_ids }))).toEqual([
					{ code: 'unknown_node_type', node_id: 'ghost' },
					{ code: 'duplicate_edge', edge_id: 'e4' },
					{ code: 'edge_into_trigger', node_id: 't', edge_id: 'e5' },
					{ code: 'unknown_port', node_id: 't', edge_id: 'e6' },
					{ code: 'cycle', node_ids: ['t', 'x', 'y'] },
				]);
			});

			it('says an empty graph has no trigger, which matters only once enabled', async () => {
				const empty = { version: 1, nodes: [], edges: [] };

				const disabled = await validate({ graph: empty }).expect(200);
				const enabled = await validate({ graph: empty, enabled: true }).expect(200);

				expect((disabled.body as { data: unknown }).data).toMatchObject({
					valid: true,
					issues: [{ code: 'no_trigger', severity: 'error', blocking: false }],
				});
				expect((enabled.body as { data: unknown }).data).toMatchObject({
					valid: false,
					issues: [{ code: 'no_trigger', severity: 'error', blocking: true }],
				});
			});

			it.each([
				['a missing graph', { enabled: true }],
				['a graph that breaks the shape rules', { graph: { ...completeGraph, version: 2 } }],
				['an unknown property', { graph: completeGraph, name: 'A' }],
			])('rejects %s with 400', async (_label, data) => {
				await validate(data).expect(400);
			});

			it('is not taken for an automation id', async () => {
				// GET, PATCH and DELETE on the same path are the /:id routes, which refuse "validate" as an id
				await request(app.getHttpServer())
					.get(`${base}/validate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(400);
			});
		});

		describe('on create', () => {
			it('refuses a structurally broken graph with 422 and the issues, even when disabled', async () => {
				const before = await countAutomations();

				const response = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Broken', graph: brokenGraph } })
					.expect(422);

				expect(response.body as GraphRejectionBody).toEqual({
					code: 'automation-graph-invalid',
					message: 'The automation graph cannot be saved: it has 1 problem(s).',
					issues: [
						{
							severity: 'error',
							code: 'unknown_port',
							message: 'Node type "test.trigger" has no output port "yes".',
							node_id: 't',
							edge_id: 'e1',
							blocking: true,
						},
					],
				});
				expect(await countAutomations()).toBe(before);
			});

			it('stores a draft while disabled and refuses it when enabled', async () => {
				const created = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Draft', graph: draftGraph } })
					.expect(201);

				expect((created.body as { data: AutomationBody }).data).toMatchObject({ enabled: false, graph: draftGraph });

				const refused = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Enabled draft', enabled: true, graph: draftGraph } })
					.expect(422);

				expect(refused.body as GraphRejectionBody).toMatchObject({
					code: 'automation-graph-invalid',
					issues: [
						{ code: 'invalid_config', node_id: 'a', field: 'level', blocking: true },
						{ code: 'unreachable_node', node_id: 'later', blocking: false },
					],
				});
			});

			it('refuses an enabled automation without a graph and stores an enabled one with a complete graph', async () => {
				const refused = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Enabled and empty', enabled: true } })
					.expect(422);

				expect((refused.body as GraphRejectionBody).issues).toMatchObject([{ code: 'no_trigger', blocking: true }]);

				const created = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Enabled and complete', enabled: true, graph: completeGraph } })
					.expect(201);

				expect((created.body as { data: AutomationBody }).data).toMatchObject({ enabled: true, graph: completeGraph });
			});
		});

		describe('on update', () => {
			const createAutomation = async (data: Record<string, unknown>): Promise<AutomationBody> => {
				const created = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data })
					.expect(201);

				return (created.body as { data: AutomationBody }).data;
			};

			const patch = (id: string, data: Record<string, unknown>) =>
				request(app.getHttpServer()).patch(`${base}/${id}`).set('Authorization', `Bearer ${ownerToken}`).send({ data });

			const read = async (id: string): Promise<AutomationBody> => {
				const detail = await request(app.getHttpServer())
					.get(`${base}/${id}`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				return (detail.body as { data: AutomationBody }).data;
			};

			it('refuses a structurally broken graph with 422 and changes nothing', async () => {
				const automation = await createAutomation({ name: 'Stays as it is', graph: completeGraph });

				const refused = await patch(automation.id, { revision: 1, name: 'Renamed', graph: brokenGraph }).expect(422);

				expect(refused.body as GraphRejectionBody).toMatchObject({
					code: 'automation-graph-invalid',
					issues: [{ code: 'unknown_port', node_id: 't', edge_id: 'e1', blocking: true }],
				});
				expect(await read(automation.id)).toMatchObject({ name: 'Stays as it is', revision: 1, graph: completeGraph });
			});

			it('refuses to enable a stored draft, then enables it once the graph is complete', async () => {
				const automation = await createAutomation({ name: 'Draft to enable', graph: draftGraph });

				const refused = await patch(automation.id, { revision: 1, enabled: true }).expect(422);

				expect(refused.body as GraphRejectionBody).toMatchObject({
					code: 'automation-graph-invalid',
					message:
						'The automation graph cannot be saved: it has 1 problem(s). An enabled automation needs a complete graph.',
					issues: [
						{ code: 'invalid_config', node_id: 'a', field: 'level', blocking: true },
						{ code: 'unreachable_node', node_id: 'later', blocking: false },
					],
				});
				expect(await read(automation.id)).toMatchObject({ enabled: false, revision: 1 });

				const enabled = await patch(automation.id, { revision: 1, enabled: true, graph: completeGraph }).expect(200);

				expect((enabled.body as { data: AutomationBody }).data).toMatchObject({
					enabled: true,
					revision: 2,
					graph: completeGraph,
				});
			});

			it('refuses to enable an automation with an empty graph', async () => {
				const automation = await createAutomation({ name: 'Empty to enable' });

				const refused = await patch(automation.id, { revision: 1, enabled: true }).expect(422);

				expect((refused.body as GraphRejectionBody).issues).toMatchObject([{ code: 'no_trigger', blocking: true }]);
			});

			it('refuses a draft for an enabled automation unless it is switched off by the same save', async () => {
				const automation = await createAutomation({ name: 'Enabled', enabled: true, graph: completeGraph });

				await patch(automation.id, { revision: 1, graph: draftGraph }).expect(422);

				const saved = await patch(automation.id, { revision: 1, enabled: false, graph: draftGraph }).expect(200);

				expect((saved.body as { data: AutomationBody }).data).toMatchObject({
					enabled: false,
					revision: 2,
					graph: draftGraph,
				});
			});

			it('answers a stale revision with 409 before it looks at the graph', async () => {
				const automation = await createAutomation({ name: 'Stale', graph: completeGraph });

				await patch(automation.id, { revision: 5, graph: brokenGraph }).expect(409);
			});
		});
	});

	describe('as admin', () => {
		it('can create, list, update and delete automations', async () => {
			const created = await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ data: { name: 'Admin automation', graph } })
				.expect(201);

			const { id } = (created.body as { data: AutomationBody }).data;

			await request(app.getHttpServer()).get(base).set('Authorization', `Bearer ${adminToken}`).expect(200);
			await request(app.getHttpServer()).get(nodeTypesBase).set('Authorization', `Bearer ${adminToken}`).expect(200);
			await request(app.getHttpServer())
				.post(`${base}/validate`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ data: { graph } })
				.expect(200);
			await request(app.getHttpServer())
				.patch(`${base}/${id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ data: { revision: 1, enabled: true } })
				.expect(200);
			await request(app.getHttpServer())
				.delete(`${base}/${id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(204);
		});
	});

	describe('role enforcement', () => {
		const calls: Array<[string, (token?: string) => request.Test]> = [
			['GET /automations', (token) => authorize(request(app.getHttpServer()).get(base), token)],
			[
				'GET /automations/:id',
				(token) => authorize(request(app.getHttpServer()).get(`${base}/${placeholderId}`), token),
			],
			[
				'POST /automations',
				(token) => authorize(request(app.getHttpServer()).post(base), token).send({ data: { name: 'Nope' } }),
			],
			[
				'PATCH /automations/:id',
				(token) =>
					authorize(request(app.getHttpServer()).patch(`${base}/${placeholderId}`), token).send({
						data: { revision: 1, name: 'Nope' },
					}),
			],
			[
				'POST /automations/validate',
				(token) =>
					authorize(request(app.getHttpServer()).post(`${base}/validate`), token).send({
						data: { graph: { version: 1, nodes: [], edges: [] } },
					}),
			],
			['GET /node-types', (token) => authorize(request(app.getHttpServer()).get(nodeTypesBase), token)],
			[
				'DELETE /automations/:id',
				(token) => authorize(request(app.getHttpServer()).delete(`${base}/${placeholderId}`), token),
			],
		];

		function authorize(call: request.Test, token?: string): request.Test {
			return token ? call.set('Authorization', `Bearer ${token}`) : call;
		}

		it.each(calls)('%s is 401 without a token', async (_label, call) => {
			await call().expect(401);
		});

		it.each(calls)('%s is 403 for a plain user', async (_label, call) => {
			await call(userToken).expect(403);
		});

		it.each(calls)('%s is 403 for a display token', async (_label, call) => {
			await call(displayToken).expect(403);
		});

		it('leaves nothing behind after the refused writes', async () => {
			const list = await request(app.getHttpServer())
				.get(base)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			expect((list.body as { data: AutomationBody[] }).data.map((row) => row.name)).not.toContain('Nope');
		});
	});
});
