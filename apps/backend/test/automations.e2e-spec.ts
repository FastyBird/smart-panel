/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';
import { Repository } from 'typeorm';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import {
	AUTOMATION_RUNS_KEPT_PER_AUTOMATION,
	AutomationMode,
	AutomationRunRecordStatus,
	EventType as AutomationsEventType,
} from '../src/modules/automations/automations.constants';
import { CreateAutomationDto } from '../src/modules/automations/dto/create-automation.dto';
import { UpdateAutomationDto } from '../src/modules/automations/dto/update-automation.dto';
import { AutomationRunEntity } from '../src/modules/automations/entities/automation-runs.entity';
import { AutomationEntity } from '../src/modules/automations/entities/automations.entity';
import { AutomationEngineService } from '../src/modules/automations/services/automation-engine.service';
import { AutomationRunHistoryService } from '../src/modules/automations/services/automation-run-history.service';
import { AutomationsService } from '../src/modules/automations/services/automations.service';
import { AutomationNodeTypeRegistryService } from '../src/modules/automations/services/node-type-registry.service';
import { AutomationStateTrackerService } from '../src/modules/automations/services/state-tracker.service';
import {
	AutomationTimeSourceService,
	HOUSE_LOCATION_NOT_SET_REASON,
} from '../src/modules/automations/services/time-source.service';
import {
	FAKE_ACTION_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_CONFIG_SCHEMA,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../src/modules/automations/testing/fake-node-types';
import { formatTimeOfDay } from '../src/modules/automations/time/house-time';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { PropertyCommandService } from '../src/modules/devices/services/property-command.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { CreateSceneDto } from '../src/modules/scenes/dto/create-scene.dto';
import { SceneActionsService } from '../src/modules/scenes/services/scene-actions.service';
import { ScenesService } from '../src/modules/scenes/services/scenes.service';
import { UserRole } from '../src/modules/users/users.constants';
import { SCENES_LOCAL_TYPE } from '../src/plugins/scenes-local/scenes-local.constants';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';

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

interface RunStepBody {
	seq: number;
	at: string;
	elapsed_ms: number;
	node_id: string;
	type: string;
	kind: string;
	via?: string;
	state: string;
	output?: string;
	observed?: unknown;
	reason?: string;
	result?: { success: boolean; reason?: string; refused?: boolean };
	delay_ms?: number;
}

interface RunBody {
	id: string;
	automation_id: string;
	revision: number;
	status: string;
	trigger_node_id: string;
	manual: boolean;
	started_at: string;
	finished_at: string | null;
	duration_ms: number | null;
	end_reason: string | null;
	created_at: string;
	updated_at: string | null;
	trace?: {
		trigger: { node_id: string; manual: boolean; data: Record<string, unknown> };
		steps: RunStepBody[];
		truncated: boolean;
	};
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
	const runsBase = '/modules/automations/runs';

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

		// The CRUD, validation and engine tests use fake node types, registered the way a module or plugin
		// registers its own from onModuleInit; the cards the module provides are covered in "built-in cards"
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
				unavailable_reason: null,
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

	describe('engine', () => {
		interface TriggerBody {
			automation_id: string;
			started: boolean;
			outcome: string;
			run_id: string | null;
			reason: string | null;
		}

		interface RuntimeBody {
			automation_id: string;
			loaded: boolean;
			status: string;
			armed: boolean;
			armed_triggers: number;
			active_runs: number;
			triggers: { started: number; ignored: number; dropped: number };
			last_skipped: { outcome: string; reason: string; node_id: string; at: string } | null;
			problems: { code: string; message: string; node_id?: string }[];
			suspended_reason: string | null;
		}

		const delayGraph = {
			version: 1,
			nodes: [
				{ id: 't', type: FAKE_TRIGGER_TYPE, position: { x: 0, y: 0 }, config: {} },
				{ id: 'wait', type: 'flow.delay', position: { x: 200, y: 0 }, config: { seconds: 60 } },
				{ id: 'a', type: FAKE_ACTION_TYPE, position: { x: 400, y: 0 }, config: {} },
			],
			edges: [
				{ id: 'e1', source: 't', source_port: 'out', target: 'wait', target_port: 'in' },
				{ id: 'e2', source: 'wait', source_port: 'out', target: 'a', target_port: 'in' },
			],
		};

		// The throttler allows 30 requests a minute per route, so only the routes under test go over HTTP:
		// automations are created, saved and read through the service, and the engine is awaited directly
		// instead of being polled.
		let automationsService: AutomationsService;
		let engine: AutomationEngineService;

		beforeAll(() => {
			automationsService = app.get(AutomationsService, { strict: false });
			engine = app.get(AutomationEngineService, { strict: false });
		});

		const createAutomation = (
			data: Omit<CreateAutomationDto, 'graph'> & { graph?: unknown },
		): Promise<AutomationEntity> => automationsService.create(data as CreateAutomationDto);

		const save = (
			id: string,
			data: Omit<UpdateAutomationDto, 'graph'> & { graph?: unknown },
		): Promise<AutomationEntity> => automationsService.update(id, data as UpdateAutomationDto);

		/** The automation once the engine has followed every save and recorded every run */
		const settled = async (id: string): Promise<AutomationEntity> => {
			await engine.settled();

			return automationsService.getOneOrThrow(id);
		};

		const runtime = async (id: string): Promise<RuntimeBody> => {
			const response = await request(app.getHttpServer())
				.get(`${base}/${id}/runtime`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			return (response.body as { data: RuntimeBody }).data;
		};

		const trigger = (id: string, body?: Record<string, unknown>): request.Test =>
			request(app.getHttpServer())
				.post(`${base}/${id}/trigger`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send(body);

		it('lists the Delay block the module provides', async () => {
			const response = await request(app.getHttpServer())
				.get(nodeTypesBase)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			expect((response.body as { data: NodeTypeBody[] }).data.find((item) => item.type === 'flow.delay')).toMatchObject(
				{
					kind: 'flow',
					name: 'Delay',
					ports: { inputs: ['in'], outputs: ['out'] },
					config_schema: { properties: { seconds: { type: 'integer', minimum: 1, maximum: 3600 } } },
				},
			);
		});

		it('refuses a delay longer than one hour on an enabled automation', async () => {
			const tooLong = {
				...delayGraph,
				nodes: delayGraph.nodes.map((item) => (item.id === 'wait' ? { ...item, config: { seconds: 3601 } } : item)),
			};

			const response = await request(app.getHttpServer())
				.post(`${base}/validate`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { enabled: true, graph: tooLong } })
				.expect(200);

			expect((response.body as { data: { valid: boolean; issues: IssueBody[] } }).data).toMatchObject({
				valid: false,
				issues: [{ code: 'invalid_config', node_id: 'wait', field: 'seconds', blocking: true }],
			});
		});

		it('runs an enabled automation by hand and records the run without moving the revision', async () => {
			const automation = await createAutomation({ name: 'Manual run', enabled: true, graph });

			const response = await trigger(automation.id).expect(200);
			const result = (response.body as { data: TriggerBody }).data;

			expect(result).toEqual({
				automation_id: automation.id,
				started: true,
				outcome: 'started',
				run_id: expect.any(String) as string,
				reason: null,
			});

			const after = await settled(automation.id);

			expect(after).toMatchObject({ lastRunStatus: 'completed', revision: 1, status: 'ok' });
			expect(after.lastTriggeredAt).toBeInstanceOf(Date);
			expect(after.updatedAt ?? null).toEqual(automation.updatedAt ?? null);

			expect(await runtime(automation.id)).toMatchObject({
				automation_id: automation.id,
				loaded: true,
				status: 'ok',
				armed: true,
				armed_triggers: 1,
				active_runs: 0,
				triggers: { started: 1, ignored: 0, dropped: 0 },
				last_skipped: null,
				problems: [],
				suspended_reason: null,
			});
		});

		it('starts at the trigger node asked for and only at a trigger node', async () => {
			const automation = await createAutomation({
				name: 'Start node',
				enabled: true,
				mode: AutomationMode.PARALLEL,
				graph,
			});

			await trigger(automation.id, { data: { node_id: 'n1' } }).expect(200);
			const refused = await trigger(automation.id, { data: { node_id: 'n2' } }).expect(422);

			expect(refused.body).toMatchObject({ code: 'not_a_trigger', message: 'A run can start only at a trigger node.' });

			await trigger(automation.id, { data: { node_id: 'nowhere' } }).expect(422);
			await trigger(automation.id, { data: { node_id: '' } }).expect(400);
			await trigger(automation.id, { data: { node_id: 'n1', extra: true } }).expect(400);
		});

		it('refuses to run a disabled automation and answers 404 for one that does not exist', async () => {
			const automation = await createAutomation({ name: 'Disabled', graph });

			const response = await trigger(automation.id).expect(422);

			// As the controller throws it; in production the 422 filter moves these into error.details
			expect(response.body).toMatchObject({ code: 'disabled', message: 'The automation is disabled.' });
			expect(await runtime(automation.id)).toMatchObject({ loaded: true, armed: false, armed_triggers: 0 });

			await trigger(placeholderId).expect(404);
			await request(app.getHttpServer())
				.get(`${base}/${placeholderId}/runtime`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(404);
			await trigger('not-a-uuid').expect(400);
		});

		it('applies the mode: a single automation ignores a second trigger while its run is parked, and disabling cancels the run', async () => {
			const automation = await createAutomation({
				name: 'Parked',
				enabled: true,
				mode: AutomationMode.SINGLE,
				graph: delayGraph,
			});

			expect(((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data.started).toBe(true);

			const second = ((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data;

			expect(second).toMatchObject({
				started: false,
				outcome: 'ignored',
				run_id: null,
				reason: 'A run is already active and the mode is single.',
			});
			expect(await runtime(automation.id)).toMatchObject({
				active_runs: 1,
				triggers: { started: 1, ignored: 1, dropped: 0 },
				last_skipped: { outcome: 'ignored', node_id: 't' },
			});

			// The run parked, so when it was triggered is already recorded
			expect(await settled(automation.id)).toMatchObject({
				lastTriggeredAt: expect.any(Date) as Date,
				lastRunStatus: null,
			});

			await save(automation.id, { revision: 1, enabled: false });

			expect(await settled(automation.id)).toMatchObject({ lastRunStatus: 'cancelled', enabled: false, revision: 2 });
			expect(await runtime(automation.id)).toMatchObject({ armed: false, active_runs: 0 });
		});

		it('a save that changes only the name leaves a parked run alone; a changed graph cancels it', async () => {
			const automation = await createAutomation({ name: 'Edited', enabled: true, graph: delayGraph });

			await trigger(automation.id).expect(200);

			await save(automation.id, { revision: 1, name: 'Renamed' });
			await engine.settled();

			expect(await runtime(automation.id)).toMatchObject({ active_runs: 1 });

			await save(automation.id, { revision: 2, graph });

			expect((await settled(automation.id)).lastRunStatus).toBe('cancelled');
			expect(await runtime(automation.id)).toMatchObject({ armed: true, active_runs: 0 });
		});

		it('marks an automation invalid when it refers to something that does not exist, and says which node', async () => {
			const automation = await createAutomation({
				name: 'Broken reference',
				enabled: true,
				graph: {
					...completeGraph,
					nodes: [
						completeGraph.nodes[0],
						{ ...completeGraph.nodes[1], config: { level: 40, scene_id: '22222222-2222-4222-8222-222222222222' } },
					],
				},
			});

			expect(await settled(automation.id)).toMatchObject({ status: 'invalid', revision: 1 });
			expect(await runtime(automation.id)).toMatchObject({
				status: 'invalid',
				armed: false,
				problems: [
					{ code: 'missing_reference', node_id: 'a', message: 'The scene this block refers to no longer exists.' },
				],
			});

			expect((await trigger(automation.id).expect(422)).body).toMatchObject({ code: 'invalid' });

			// Saving a graph without the broken reference heals it
			await save(automation.id, { revision: 1, graph: completeGraph });

			expect(await settled(automation.id)).toMatchObject({ status: 'ok', revision: 2 });
			await trigger(automation.id).expect(200);
		});

		describe('run history', () => {
			let history: AutomationRunHistoryService;
			let runsRepository: Repository<AutomationRunEntity>;
			let eventEmitter: EventEmitter2;

			beforeAll(() => {
				history = app.get(AutomationRunHistoryService, { strict: false });
				runsRepository = app.get<Repository<AutomationRunEntity>>(getRepositoryToken(AutomationRunEntity), {
					strict: false,
				});
				eventEmitter = app.get(EventEmitter2, { strict: false });
			});

			const listRuns = async (id: string): Promise<RunBody[]> => {
				const response = await request(app.getHttpServer())
					.get(`${base}/${id}/runs`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				return (response.body as { data: RunBody[] }).data;
			};

			const readRun = async (runId: string): Promise<RunBody> => {
				const response = await request(app.getHttpServer())
					.get(`${runsBase}/${runId}`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				return (response.body as { data: RunBody }).data;
			};

			/** Resolves when the next run of the automation is announced as over, which is after it was written */
			const whenCompleted = (automationId: string): Promise<void> =>
				new Promise<void>((resolve) => {
					const listener = (payload: { automation_id?: string }): void => {
						if (payload.automation_id !== automationId) return;

						eventEmitter.off(AutomationsEventType.RUN_COMPLETED, listener);
						resolve();
					};

					eventEmitter.on(AutomationsEventType.RUN_COMPLETED, listener);
				});

			/** Collects what the bus carries for the runs of one automation while `work` runs */
			const runEvents = async (
				automationId: string,
				work: () => Promise<void>,
			): Promise<[string, Record<string, unknown>][]> => {
				const seen: [string, Record<string, unknown>][] = [];
				const listener = (event: string | string[], payload: Record<string, unknown>): void => {
					if (
						typeof event === 'string' &&
						event.startsWith('AutomationsModule.Run.') &&
						payload.automation_id === automationId
					) {
						seen.push([event, payload]);
					}
				};

				eventEmitter.onAny(listener);

				try {
					await work();
				} finally {
					eventEmitter.offAny(listener);
				}

				return seen;
			};

			it('records a run with its trace, lists it without the trace and announces it', async () => {
				const automation = await createAutomation({ name: 'Traced', enabled: true, graph });

				let runId = '';

				const events = await runEvents(automation.id, async () => {
					const completed = whenCompleted(automation.id);

					runId = ((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data.run_id ?? '';

					await completed;
				});

				const listed = await listRuns(automation.id);

				expect(listed).toEqual([
					{
						id: runId,
						automation_id: automation.id,
						revision: 1,
						status: 'completed',
						trigger_node_id: 'n1',
						manual: true,
						started_at: expect.any(String) as string,
						finished_at: expect.any(String) as string,
						duration_ms: expect.any(Number) as number,
						end_reason: null,
						created_at: expect.any(String) as string,
						updated_at: null,
					},
				]);
				expect(new Date(listed[0].started_at).toISOString()).toBe(listed[0].started_at);

				const run = await readRun(runId);

				expect(run).toMatchObject({ ...listed[0], updated_at: run.updated_at });
				expect(run.trace).toEqual({
					trigger: { node_id: 'n1', manual: true, data: { manual: true } },
					steps: [
						{
							seq: 1,
							at: expect.any(String) as string,
							elapsed_ms: expect.any(Number) as number,
							node_id: 'n2',
							type: FAKE_ACTION_TYPE,
							kind: 'action',
							via: 'e1',
							state: 'done',
							output: 'done',
							result: { success: true },
						},
					],
					truncated: false,
				});

				expect(events.map(([event]) => event)).toEqual([
					'AutomationsModule.Run.Started',
					'AutomationsModule.Run.Completed',
				]);
				expect(events[0][1]).toMatchObject({ id: runId, automation_id: automation.id, status: 'running' });
				expect(events[1][1]).toMatchObject({ id: runId, automation_id: automation.id, status: 'completed' });
				expect(events[1][1]).not.toHaveProperty('trace');
			});

			it('stores a run that parks as running, with the Delay it waits on, and rewrites it when it is cancelled', async () => {
				const automation = await createAutomation({ name: 'Parked trace', enabled: true, graph: delayGraph });

				const runId = ((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data.run_id ?? '';

				await engine.settled();

				const parked = await readRun(runId);

				expect(parked).toMatchObject({ status: 'running', finished_at: null, duration_ms: null, end_reason: null });
				expect(parked.trace?.steps).toEqual([
					expect.objectContaining({ node_id: 'wait', kind: 'flow', state: 'parked', delay_ms: 60_000 }),
				]);

				await save(automation.id, { revision: 1, enabled: false });
				await engine.settled();

				const cancelled = await readRun(runId);

				expect(cancelled).toMatchObject({
					status: 'cancelled',
					finished_at: expect.any(String) as string,
					duration_ms: expect.any(Number) as number,
				});
				expect(cancelled.end_reason).toEqual(expect.any(String));
				expect(cancelled.trace?.steps).toEqual([expect.objectContaining({ node_id: 'wait', state: 'cancelled' })]);
				expect(await listRuns(automation.id)).toHaveLength(1);
			});

			it('shows a run the backend was restarted under as interrupted', async () => {
				const automation = await createAutomation({ name: 'Cut off', enabled: true, graph: delayGraph });
				const startedAt = new Date(Date.now() - 5 * 60_000);

				// What a power loss leaves behind: the marker of a run that parked and never ended
				await history.store({
					id: '99999999-9999-4999-8999-999999999999',
					automationId: automation.id,
					revision: 1,
					status: AutomationRunRecordStatus.RUNNING,
					triggerNodeId: 't',
					manual: false,
					startedAt,
					finishedAt: null,
					durationMs: null,
					endReason: null,
					trace: {
						trigger: { node_id: 't', manual: false, data: {} },
						steps: [
							{
								seq: 1,
								at: startedAt.toISOString(),
								elapsed_ms: 0,
								node_id: 'wait',
								type: 'flow.delay',
								kind: 'flow',
								via: 'e1',
								state: 'parked',
								delay_ms: 60_000,
							},
						],
						truncated: false,
					},
				});

				// A run that is parked while the engine stops in an orderly way is ended by the engine itself
				const runId = ((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data.run_id ?? '';

				await engine.settled();
				await engine.stop();
				await engine.start();

				const runs = await listRuns(automation.id);

				expect(runs.map((run) => [run.id, run.status, run.end_reason, run.finished_at === null])).toEqual([
					[runId, 'interrupted', 'engine_stopped', false],
					['99999999-9999-4999-8999-999999999999', 'interrupted', 'backend_restarted', true],
				]);

				// The trace still says which Delay never let the run go on
				expect((await readRun('99999999-9999-4999-8999-999999999999')).trace?.steps).toEqual([
					expect.objectContaining({ node_id: 'wait', state: 'parked', delay_ms: 60_000 }),
				]);
				expect((await settled(automation.id)).lastRunStatus).toBe('interrupted');
				expect(await runtime(automation.id)).toMatchObject({ loaded: true, armed: true, active_runs: 0 });
			});

			it('keeps the last runs of an automation only', async () => {
				const automation = await createAutomation({
					name: 'Busy',
					enabled: true,
					mode: AutomationMode.PARALLEL,
					graph,
				});

				// Written straight to the history: the overload guard allows 30 runs a minute and the throttler 30 requests
				const startedAt = Date.now() - 3_600_000;

				for (let index = 0; index < AUTOMATION_RUNS_KEPT_PER_AUTOMATION; index += 1) {
					await history.store({
						id: `88888888-8888-4888-8888-${String(index).padStart(12, '0')}`,
						automationId: automation.id,
						revision: 1,
						status: AutomationRunRecordStatus.COMPLETED,
						triggerNodeId: 'n1',
						manual: false,
						startedAt: new Date(startedAt + index * 1000),
						finishedAt: new Date(startedAt + index * 1000 + 5),
						durationMs: 5,
						endReason: null,
						trace: { trigger: { node_id: 'n1', manual: false, data: {} }, steps: [], truncated: false },
					});
				}

				const completed = whenCompleted(automation.id);
				const outcome = await engine.triggerOrThrow(automation.id);

				await completed;

				const runs = await listRuns(automation.id);

				expect(runs).toHaveLength(AUTOMATION_RUNS_KEPT_PER_AUTOMATION);
				expect(runs[0].id).toBe(outcome.outcome === 'started' ? outcome.runId : '');
				expect(runs.map((run) => run.id)).not.toContain('88888888-8888-4888-8888-000000000000');
				expect(runs.at(-1)?.id).toBe('88888888-8888-4888-8888-000000000001');
			});

			it('deletes the runs of an automation with it and answers 404 and 400 where it should', async () => {
				const automation = await createAutomation({ name: 'Short lived', enabled: true, graph });
				const completed = whenCompleted(automation.id);
				const runId = ((await trigger(automation.id).expect(200)).body as { data: TriggerBody }).data.run_id ?? '';

				await completed;
				await readRun(runId);

				await automationsService.remove(automation.id);
				await engine.settled();

				expect(await runsRepository.countBy({ automationId: automation.id })).toBe(0);

				const get = (path: string): request.Test =>
					request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${ownerToken}`);

				await get(`${runsBase}/${runId}`).expect(404);
				await get(`${base}/${automation.id}/runs`).expect(404);
				await get(`${runsBase}/not-a-uuid`).expect(400);
				await get(`${base}/not-a-uuid/runs`).expect(400);
			});
		});

		it('forgets an automation that is deleted', async () => {
			const automation = await createAutomation({ name: 'Deleted', enabled: true, graph: delayGraph });

			await trigger(automation.id).expect(200);
			await automationsService.remove(automation.id);
			await engine.settled();

			expect(engine.runtime(automation.id)).toBeUndefined();
			await trigger(automation.id).expect(404);
		});
	});

	describe('built-in cards', () => {
		interface PropertyBody {
			id: string;
			category: string;
		}

		interface ChannelBody {
			id: string;
			category: string;
			properties: PropertyBody[];
		}

		interface DeviceBody {
			id: string;
			channels: ChannelBody[];
		}

		interface Target {
			device_id: string;
			channel_id: string;
			property_id: string;
		}

		let automationsService: AutomationsService;
		let engine: AutomationEngineService;
		let stateTracker: AutomationStateTrackerService;
		let timeSource: AutomationTimeSourceService;
		let propertiesService: ChannelsPropertiesService;
		let propertyValueService: PropertyValueService;
		let propertyCommands: PropertyCommandService;

		let occupancy: Target;
		let illuminance: Target;
		let lightOn: Target;
		let lightBrightness: Target;

		const createDevice = async (data: Record<string, unknown>): Promise<DeviceBody> => {
			const response = await request(app.getHttpServer())
				.post('/modules/devices/devices')
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: SIMULATOR_TYPE, ...data } })
				.expect(201);

			return (response.body as { data: DeviceBody }).data;
		};

		const targetOf = (device: DeviceBody, channelCategory: string, propertyCategory: string): Target => {
			const channel = device.channels.find((item) => item.category === channelCategory);
			const property = channel?.properties.find((item) => item.category === propertyCategory);

			if (!channel || !property) {
				throw new Error(`The device has no ${channelCategory}.${propertyCategory} property`);
			}

			return { device_id: device.id, channel_id: channel.id, property_id: property.id };
		};

		/** What a device would report: the value is stored and announced on the bus, as the simulator does it */
		const report = async (target: Target, value: string | number | boolean): Promise<void> => {
			await propertiesService.update(target.property_id, { type: SIMULATOR_TYPE, value });
		};

		const valueOf = async (target: Target): Promise<unknown> => {
			const property = await propertiesService.findOne(target.property_id);

			return property ? ((await propertyValueService.readLatest(property))?.value ?? null) : null;
		};

		const light = async (): Promise<{ on: unknown; brightness: unknown }> => ({
			on: await valueOf(lightOn),
			brightness: await valueOf(lightBrightness),
		});

		/** Polls the backend itself, not HTTP: the throttler allows 30 requests a minute per route */
		const waitFor = async <T>(read: () => Promise<T>, done: (value: T) => boolean, what: string): Promise<T> => {
			const deadline = Date.now() + 10_000;

			for (;;) {
				const value = await read();

				if (done(value)) return value;

				if (Date.now() > deadline) {
					throw new Error(`Timed out waiting for ${what}; last seen ${JSON.stringify(value)}`);
				}

				await new Promise((resolve) => setTimeout(resolve, 25));
			}
		};

		/** The engine has followed every save, every baseline is read and every run is recorded */
		const settled = async (): Promise<void> => {
			await engine.settled();
			await stateTracker.settled();
			await engine.settled();
		};

		/** Waits until the automation has started `more` further runs and none of them is still going */
		const afterRuns = async (id: string, more: number, act: () => Promise<void>): Promise<void> => {
			const started = engine.runtime(id)?.triggers.started ?? 0;

			await act();

			await waitFor(
				() => Promise.resolve(engine.runtime(id)),
				(state) => (state?.triggers.started ?? 0) >= started + more && state?.activeRuns === 0,
				`${more} more run(s) of the automation`,
			);
			await settled();
		};

		/** A window of the house clock that holds right now, or one that does not */
		const windowAroundNow = (holds: boolean): { from: string; to: string } => {
			const reading = timeSource.houseNow();

			if (reading.status !== 'ok') {
				throw new Error(`The house time is not known: ${reading.reason}`);
			}

			const at = (offset: number): string => formatTimeOfDay((reading.local.minutes + offset + 1440) % 1440);

			return holds ? { from: at(-120), to: at(120) } : { from: at(180), to: at(300) };
		};

		const VACANT_FOR_SECONDS = 1;

		/**
		 * The reference scenario: somebody enters a dark room and the light goes on, dimmed at night; once
		 * the room has been empty for a while the light goes off.
		 */
		const referenceGraph = (night: { from: string; to: string }) => ({
			version: 1,
			nodes: [
				{
					id: 'occupied',
					type: 'device.property.changed',
					position: { x: 0, y: 0 },
					config: { ...occupancy, to: true },
				},
				{
					id: 'dark',
					type: 'device.property.compare',
					position: { x: 200, y: 0 },
					config: { ...illuminance, operator: 'lt', value: 50 },
				},
				{ id: 'night', type: 'time.window', position: { x: 400, y: 0 }, config: night },
				{
					id: 'dimmed',
					type: 'device.property.set',
					position: { x: 600, y: -80 },
					config: {
						writes: [
							{ ...lightOn, value: true },
							{ ...lightBrightness, value: 20 },
						],
					},
				},
				{
					id: 'full',
					type: 'device.property.set',
					position: { x: 600, y: 80 },
					config: {
						writes: [
							{ ...lightOn, value: true },
							{ ...lightBrightness, value: 100 },
						],
					},
				},
				{
					id: 'vacant',
					type: 'device.property.changed',
					position: { x: 0, y: 240 },
					config: { ...occupancy, to: false, for_seconds: VACANT_FOR_SECONDS },
				},
				{
					id: 'off',
					type: 'device.property.set',
					position: { x: 200, y: 240 },
					config: { writes: [{ ...lightOn, value: false }] },
				},
			],
			edges: [
				{ id: 'e1', source: 'occupied', source_port: 'out', target: 'dark', target_port: 'in' },
				{ id: 'e2', source: 'dark', source_port: 'yes', target: 'night', target_port: 'in' },
				{ id: 'e3', source: 'night', source_port: 'yes', target: 'dimmed', target_port: 'in' },
				{ id: 'e4', source: 'night', source_port: 'no', target: 'full', target_port: 'in' },
				{ id: 'e5', source: 'vacant', source_port: 'out', target: 'off', target_port: 'in' },
			],
		});

		beforeAll(async () => {
			automationsService = app.get(AutomationsService, { strict: false });
			engine = app.get(AutomationEngineService, { strict: false });
			stateTracker = app.get(AutomationStateTrackerService, { strict: false });
			timeSource = app.get(AutomationTimeSourceService, { strict: false });
			propertiesService = app.get(ChannelsPropertiesService, { strict: false });
			propertyValueService = app.get(PropertyValueService, { strict: false });
			propertyCommands = app.get(PropertyCommandService, { strict: false });

			const sensor = await createDevice({
				category: DeviceCategory.SENSOR,
				name: 'Hallway sensor',
				channels: [
					{
						type: SIMULATOR_TYPE,
						category: ChannelCategory.OCCUPANCY,
						identifier: 'occupancy',
						name: 'Occupancy',
						properties: [
							{
								type: SIMULATOR_TYPE,
								category: PropertyCategory.DETECTED,
								identifier: 'detected',
								name: 'Detected',
								permissions: [PermissionType.READ_ONLY],
								data_type: DataTypeType.BOOL,
								value: false,
							},
						],
					},
					{
						type: SIMULATOR_TYPE,
						category: ChannelCategory.ILLUMINANCE,
						identifier: 'illuminance',
						name: 'Illuminance',
						properties: [
							{
								type: SIMULATOR_TYPE,
								category: PropertyCategory.ILLUMINANCE,
								identifier: 'illuminance',
								name: 'Illuminance',
								permissions: [PermissionType.READ_ONLY],
								data_type: DataTypeType.FLOAT,
								value: 10,
							},
						],
					},
				],
			});

			const lamp = await createDevice({
				category: DeviceCategory.LIGHTING,
				name: 'Hallway light',
				channels: [
					{
						type: SIMULATOR_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						properties: [
							{
								type: SIMULATOR_TYPE,
								category: PropertyCategory.ON,
								identifier: 'on',
								name: 'On',
								permissions: [PermissionType.READ_WRITE],
								data_type: DataTypeType.BOOL,
								value: false,
							},
							{
								type: SIMULATOR_TYPE,
								category: PropertyCategory.BRIGHTNESS,
								identifier: 'brightness',
								name: 'Brightness',
								permissions: [PermissionType.READ_WRITE],
								data_type: DataTypeType.UCHAR,
								format: [0, 100],
								value: 100,
							},
						],
					},
				],
			});

			occupancy = targetOf(sensor, ChannelCategory.OCCUPANCY, PropertyCategory.DETECTED);
			illuminance = targetOf(sensor, ChannelCategory.ILLUMINANCE, PropertyCategory.ILLUMINANCE);
			lightOn = targetOf(lamp, ChannelCategory.LIGHT, PropertyCategory.ON);
			lightBrightness = targetOf(lamp, ChannelCategory.LIGHT, PropertyCategory.BRIGHTNESS);
		}, 60_000);

		it('lists the cards the module provides, by kind', async () => {
			const response = await request(app.getHttpServer())
				.get(nodeTypesBase)
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			// The space cards are provided by the spaces-home-control plugin, not by the module
			const builtIn = (response.body as { data: NodeTypeBody[] }).data.filter(
				(item) => !item.type.startsWith('test.') && !item.type.startsWith('space.'),
			);

			expect(builtIn.map((item) => `${item.kind} ${item.type}`)).toEqual([
				'action automation.disable',
				'action automation.enable',
				'action automation.run',
				'trigger device.button.pressed',
				'trigger device.connection.changed',
				'trigger device.property.changed',
				'condition device.property.compare',
				'action device.property.set',
				'flow flow.all',
				'flow flow.any',
				'flow flow.delay',
				'flow flow.wait-until',
				'trigger house-mode.changed',
				'condition house-mode.is',
				'action house-mode.set',
				'trigger manual.start',
				'action notification.send',
				'action scene.run',
				'trigger scene.was-run',
				'action security.arm',
				'condition security.armed.is',
				'trigger security.state.changed',
				'condition sun.daylight',
				'trigger sun.event',
				'trigger time.of-day',
				'condition time.window',
			]);

			// Every card describes its configuration, so a form can be built for it
			for (const item of builtIn) {
				expect(item.config_schema).toMatchObject({ type: 'object', additionalProperties: false });
			}

			expect(builtIn.find((item) => item.type === 'device.property.compare')?.config_schema).toMatchObject({
				required: ['device_id', 'channel_id', 'property_id', 'operator'],
				'x-operators-by-value-kind': { boolean: ['eq', 'neq'] },
			});
		});

		describe('templates', () => {
			const templatesBase = '/modules/automations/templates';

			it('lists the built-in templates with their questions', async () => {
				const response = await request(app.getHttpServer())
					.get(templatesBase)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				const templates = (response.body as { data: { id: string; source: string; parameters: { id: string }[] }[] })
					.data;

				expect(templates.map((template) => template.id)).toEqual([
					'away-heating-setback',
					'door-open-reminder',
					'leak-alarm',
					'motion-light',
				]);
				expect(templates.find((template) => template.id === 'motion-light')?.parameters.map((item) => item.id)).toEqual(
					['motion', 'light', 'off_after'],
				);
				expect(templates[0]).not.toHaveProperty('graph');
				expect(templates.every((template) => template.source === 'builtin')).toBe(true);
			});

			it('generates a draft that is saved as an ordinary enabled automation, with no link to the template', async () => {
				const before = await request(app.getHttpServer())
					.get(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				const generated = await request(app.getHttpServer())
					.post(`${templatesBase}/motion-light/generate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { parameters: { motion: occupancy, light: lightOn, off_after: 300 } } })
					.expect(200);

				const draft = (generated.body as { data: { name: string; mode: string; graph: { nodes: unknown[] } } }).data;

				expect(draft).toMatchObject({ name: 'Motion light', mode: 'parallel' });
				expect(draft.graph.nodes).toEqual([
					expect.objectContaining({ type: 'device.property.changed', config: { ...occupancy, to: true } }),
					expect.objectContaining({ type: 'device.property.set', config: { writes: [{ ...lightOn, value: true }] } }),
					expect.objectContaining({ config: { ...occupancy, to: false, for_seconds: 300 } }),
					expect.objectContaining({ config: { writes: [{ ...lightOn, value: false }] } }),
				]);

				// Generating stores nothing
				const after = await request(app.getHttpServer())
					.get(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				expect((after.body as { data: unknown[] }).data).toHaveLength((before.body as { data: unknown[] }).data.length);

				const created = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: draft.name, mode: draft.mode, enabled: true, graph: draft.graph } })
					.expect(201);

				const automation = (created.body as { data: AutomationBody }).data;

				expect(automation.enabled).toBe(true);
				expect(JSON.stringify(automation)).not.toContain('motion-light');

				await request(app.getHttpServer())
					.delete(`${base}/${automation.id}`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(204);
			});

			it('refuses answers that do not fit their questions with 422 and an issue per question', async () => {
				const response = await request(app.getHttpServer())
					.post(`${templatesBase}/motion-light/generate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { parameters: { motion: lightOn, light: occupancy, off_after: 5 } } })
					.expect(422);

				expect(response.body).toMatchObject({
					code: 'automation-template-parameters-invalid',
					issues: [
						{ field: 'parameters.motion.channel_id', reason: 'This channel is not of a kind this question takes.' },
						{ field: 'parameters.motion.property_id', reason: 'This property is not of a kind this question takes.' },
						{ field: 'parameters.light.property_id', reason: 'This property can not be set.' },
						{ field: 'parameters.light.channel_id', reason: 'This channel is not of a kind this question takes.' },
						{ field: 'parameters.light.property_id', reason: 'This property is not of a kind this question takes.' },
						{ field: 'parameters.off_after', reason: 'The duration must be between 10 and 86400 seconds.' },
					],
				});
			});

			it('answers 404 for a template that does not exist and 400 without answers', async () => {
				await request(app.getHttpServer())
					.post(`${templatesBase}/missing/generate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { parameters: {} } })
					.expect(404);

				await request(app.getHttpServer())
					.post(`${templatesBase}/leak-alarm/generate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: {} })
					.expect(400);
			});
		});

		it('lists the space cards of the spaces-home-control plugin only while it is enabled', async () => {
			const spaceCards = async (): Promise<string[]> => {
				const response = await request(app.getHttpServer())
					.get(nodeTypesBase)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				return (response.body as { data: NodeTypeBody[] }).data
					.filter((item) => item.type.startsWith('space.'))
					.map((item) => `${item.kind} ${item.type}`);
			};

			const setPluginEnabled = (enabled: boolean) =>
				request(app.getHttpServer())
					.patch('/modules/config/config/plugin/spaces-home-control-plugin')
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { type: 'spaces-home-control-plugin', enabled } })
					.expect(200);

			expect(await spaceCards()).toEqual([
				'action space.lighting.intent',
				'trigger space.mode.changed',
				'condition space.mode.is',
				'action space.mode.set',
				'trigger space.occupancy.changed',
				'condition space.occupancy.is',
			]);

			try {
				await setPluginEnabled(false);

				expect(await spaceCards()).toEqual([]);
			} finally {
				await setPluginEnabled(true);
			}

			expect(await spaceCards()).toHaveLength(6);
		});

		describe('sun cards', () => {
			const setHouseLocation = (latitude: number | null, longitude: number | null) =>
				request(app.getHttpServer())
					.patch('/modules/config/config/module/system-module')
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { type: 'system-module', latitude, longitude } })
					.expect(200);

			const sunGraph = () => ({
				version: 1,
				nodes: [
					{
						id: 'dusk',
						type: 'sun.event',
						position: { x: 0, y: 0 },
						config: { event: 'sunset', offset_minutes: -30 },
					},
					{ id: 'dark', type: 'sun.daylight', position: { x: 200, y: 0 }, config: { state: 'night' } },
					{
						id: 'on',
						type: 'device.property.set',
						position: { x: 400, y: 0 },
						config: { writes: [{ ...lightOn, value: true }] },
					},
				],
				edges: [
					{ id: 'e1', source: 'dusk', source_port: 'out', target: 'dark', target_port: 'in' },
					{ id: 'e2', source: 'dark', source_port: 'no', target: 'on', target_port: 'in' },
				],
			});

			afterAll(async () => {
				await setHouseLocation(null, null);
			});

			it('are unavailable without a house location: a draft is kept, enabling is refused', async () => {
				await setHouseLocation(null, null);

				const nodeTypes = await request(app.getHttpServer())
					.get(nodeTypesBase)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(200);

				const sun = (nodeTypes.body as { data: (NodeTypeBody & { unavailable_reason: string | null })[] }).data.filter(
					(item) => item.type.startsWith('sun.'),
				);

				expect(sun.map((item) => item.unavailable_reason)).toEqual([
					HOUSE_LOCATION_NOT_SET_REASON,
					HOUSE_LOCATION_NOT_SET_REASON,
				]);

				const validation = await request(app.getHttpServer())
					.post(`${base}/validate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { graph: sunGraph(), enabled: true } })
					.expect(200);

				expect((validation.body as { data: unknown }).data).toEqual({
					valid: false,
					issues: [
						{
							severity: 'error',
							code: 'node_type_unavailable',
							message: HOUSE_LOCATION_NOT_SET_REASON,
							node_id: 'dusk',
							blocking: true,
						},
						{
							severity: 'error',
							code: 'node_type_unavailable',
							message: HOUSE_LOCATION_NOT_SET_REASON,
							node_id: 'dark',
							blocking: true,
						},
					],
				});

				await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Lights at dusk', enabled: true, graph: sunGraph() } })
					.expect(422);

				const draft = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Lights at dusk, draft', enabled: false, graph: sunGraph() } })
					.expect(201);

				await request(app.getHttpServer())
					.delete(`${base}/${(draft.body as { data: AutomationBody }).data.id}`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(204);
			});

			it('are available once the house location is set, and an automation using them can be enabled', async () => {
				await setHouseLocation(50.0755, 14.4378);

				const validation = await request(app.getHttpServer())
					.post(`${base}/validate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { graph: sunGraph(), enabled: true } })
					.expect(200);

				expect((validation.body as { data: unknown }).data).toEqual({ valid: true, issues: [] });

				const created = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Lights at dusk', enabled: true, graph: sunGraph() } })
					.expect(201);

				const id = (created.body as { data: AutomationBody }).data.id;

				await engine.settled();

				expect(engine.runtime(id)).toMatchObject({ status: 'ok', armed: true, armedTriggers: 1 });

				await request(app.getHttpServer())
					.delete(`${base}/${id}`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.expect(204);
			});
		});

		it('refuses a card configured against the property it points at, node by node', async () => {
			const graph = referenceGraph(windowAroundNow(true));

			const broken = {
				...graph,
				nodes: graph.nodes.map((item) => {
					switch (item.id) {
						case 'occupied':
							// A duration needs a state that can hold; "from" names none
							return { ...item, config: { ...occupancy, from: false, for_seconds: 30 } };
						case 'dark':
							// Occupancy is a yes/no value: it can not be "less than"
							return { ...item, config: { ...occupancy, operator: 'lt', value: 50 } };
						case 'night':
							return { ...item, config: { from: '22:00', to: '22:00' } };
						case 'off':
							// A sensor reading can not be set
							return { ...item, config: { writes: [{ ...occupancy, value: false }] } };
						default:
							return item;
					}
				}),
			};

			const response = await request(app.getHttpServer())
				.post(`${base}/validate`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { enabled: true, graph: broken } })
				.expect(200);

			const result = (response.body as { data: { valid: boolean; issues: IssueBody[] } }).data;

			expect(result.valid).toBe(false);
			expect(result.issues.map((issue) => `${issue.node_id}:${issue.field}`).sort()).toEqual([
				'dark:operator',
				'night:to',
				'occupied:for_seconds',
				'off:writes.0.property_id',
			]);
			expect(result.issues.every((issue) => issue.code === 'invalid_config' && issue.blocking)).toBe(true);
		});

		it('runs the reference scenario: a dimmed light at night, a full one by day, off once the room is empty', async () => {
			const commands = jest.spyOn(propertyCommands, 'executePropertyCommands');

			try {
				// A dark, empty room with the light off
				await report(occupancy, false);
				await report(illuminance, 10);

				const automation = await automationsService.create({
					name: 'Hallway light',
					enabled: true,
					graph: referenceGraph(windowAroundNow(true)),
				} as unknown as CreateAutomationDto);

				await settled();

				expect(engine.runtime(automation.id)).toMatchObject({ status: 'ok', armed: true, armedTriggers: 2 });
				expect(await light()).toEqual({ on: false, brightness: 100 });

				// ---- night: somebody walks in ------------------------------------------------------------

				await report(occupancy, true);

				expect(
					await waitFor(light, (state) => state.on === true && state.brightness === 20, 'the dimmed light'),
				).toEqual({ on: true, brightness: 20 });

				await settled();

				// Both values of the light went out as one command batch for the one device
				expect(commands).toHaveBeenCalledTimes(1);
				expect(commands.mock.calls[0][0]).toEqual([
					{
						propertyId: lightOn.property_id,
						value: true,
						requestedDeviceId: lightOn.device_id,
						requestedChannelId: lightOn.channel_id,
					},
					{
						propertyId: lightBrightness.property_id,
						value: 20,
						requestedDeviceId: lightBrightness.device_id,
						requestedChannelId: lightBrightness.channel_id,
					},
				]);
				// ... and carries the automation as the origin of its intent
				expect(commands.mock.calls[0][1]).toEqual({
					context: { origin: 'automation', extra: { automationId: automation.id } },
				});

				// The sensor reporting "occupied" again is not a change and starts nothing
				await report(occupancy, true);
				await settled();

				expect(commands).toHaveBeenCalledTimes(1);

				// ---- the room empties: the light stays on until it has been empty long enough ------------

				let leftAt = 0;

				// The count of runs is taken before the room empties, so the run is counted however long the
				// reads of the light take
				await afterRuns(automation.id, 1, async () => {
					leftAt = Date.now();

					await report(occupancy, false);

					expect((await light()).on).toBe(true);

					await waitFor(light, (state) => state.on === false, 'the light going off');
				});

				expect(Date.now() - leftAt).toBeGreaterThanOrEqual(VACANT_FOR_SECONDS * 1000 - 50);
				expect((await automationsService.getOneOrThrow(automation.id)).lastRunStatus).toBe('completed');

				// ---- somebody comes back before the time is up: the light stays on -----------------------

				await report(occupancy, true);
				await waitFor(light, (state) => state.on === true, 'the light coming on again');
				await report(occupancy, false);
				await new Promise((resolve) => setTimeout(resolve, (VACANT_FOR_SECONDS * 1000) / 2));
				await report(occupancy, true);
				await new Promise((resolve) => setTimeout(resolve, VACANT_FOR_SECONDS * 1000));
				await settled();

				expect((await light()).on).toBe(true);

				// ---- day: the same graph outside the night window gives the full light -------------------

				await report(occupancy, false);
				await waitFor(light, (state) => state.on === false, 'the light going off before the day run');
				await settled();

				const saved = await automationsService.getOneOrThrow(automation.id);

				await automationsService.update(automation.id, {
					revision: saved.revision,
					graph: referenceGraph(windowAroundNow(false)),
				} as unknown as UpdateAutomationDto);
				await settled();

				await report(occupancy, true);

				expect(
					await waitFor(light, (state) => state.on === true && state.brightness === 100, 'the full light'),
				).toEqual({ on: true, brightness: 100 });

				// ---- a bright room: the light is left alone ------------------------------------------------

				await report(occupancy, false);
				await waitFor(light, (state) => state.on === false, 'the light going off before the bright run');
				await settled();

				await report(illuminance, 400);

				const before = commands.mock.calls.length;

				// The run starts, and ends at the "no" of the condition
				await afterRuns(automation.id, 1, () => report(occupancy, true));

				expect(commands).toHaveBeenCalledTimes(before);
				expect((await light()).on).toBe(false);
				expect((await automationsService.getOneOrThrow(automation.id)).lastRunStatus).toBe('completed');

				// ---- the history explains every run: what the conditions saw and what the actions answered --

				const runHistory = app.get(AutomationRunHistoryService, { strict: false });
				const runs = await runHistory.findAllForAutomation(automation.id);
				const traces = await Promise.all(runs.map(async (run) => (await runHistory.findOne(run.id))?.trace));
				const steps = traces.flatMap((trace) => trace?.steps ?? []);

				expect(runs.length).toBeGreaterThanOrEqual(4);
				expect(runs.every((run) => run.manual === false)).toBe(true);
				expect(traces.every((trace) => trace?.truncated === false)).toBe(true);
				// The newest run is the one of the bright room: it ended at the "no" of a condition, which saw the light level
				expect(traces[0]?.trigger.node_id).toEqual(expect.any(String));
				expect(traces[0]?.steps.at(-1)).toMatchObject({ kind: 'condition', state: 'done', output: 'no' });
				expect(traces[0]?.steps.at(-1)).toHaveProperty('observed');
				expect(steps.some((step) => step.kind === 'condition' && step.output === 'yes' && 'observed' in step)).toBe(
					true,
				);
				expect(steps.some((step) => step.kind === 'action' && step.output === 'done' && step.result?.success)).toBe(
					true,
				);

				// ---- cleanup ---------------------------------------------------------------------------------

				await automationsService.remove(automation.id);
				await settled();

				expect(stateTracker.pendingTimers()).toBe(0);
			} finally {
				commands.mockRestore();
			}
		}, 60_000);

		it('raises a notification from an automation that is run by hand', async () => {
			const automation = await automationsService.create({
				name: 'Tell me',
				enabled: true,
				graph: {
					version: 1,
					nodes: [
						{ id: 'start', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
						{
							id: 'tell',
							type: 'notification.send',
							position: { x: 200, y: 0 },
							config: { severity: 'warning', title: 'The hallway was checked', message: 'By hand.' },
						},
					],
					edges: [{ id: 'e1', source: 'start', source_port: 'out', target: 'tell', target_port: 'in' }],
				},
			} as unknown as CreateAutomationDto);

			await settled();

			// A manual start watches nothing, yet the automation is armed and can be run
			expect(engine.runtime(automation.id)).toMatchObject({ status: 'ok', armed: true });

			await afterRuns(automation.id, 1, async () => {
				await request(app.getHttpServer())
					.post(`${base}/${automation.id}/trigger`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send()
					.expect(200);
			});

			expect((await automationsService.getOneOrThrow(automation.id)).lastRunStatus).toBe('completed');

			const response = await request(app.getHttpServer())
				.get('/modules/notifications/notifications')
				.query({ source: 'automations-module' })
				.set('Authorization', `Bearer ${ownerToken}`)
				.expect(200);

			const notifications = (
				response.body as {
					data: { title: string; severity: string; kind: string; message: string | null; source: string }[];
				}
			).data;

			expect(notifications.find((item) => item.title === 'The hallway was checked')).toMatchObject({
				source: 'automations-module',
				kind: 'event',
				severity: 'warning',
				message: 'By hand.',
			});

			await automationsService.remove(automation.id);
			await settled();
		});

		it('marks an automation invalid when the scene it runs does not exist, and arms no time trigger for it', async () => {
			const missingScene = '22222222-2222-4222-8222-222222222222';

			const automation = await automationsService.create({
				name: 'Evening scene',
				enabled: true,
				graph: {
					version: 1,
					nodes: [
						{ id: 'at', type: 'time.of-day', position: { x: 0, y: 0 }, config: { time: '21:30', weekdays: [5, 6] } },
						{ id: 'scene', type: 'scene.run', position: { x: 200, y: 0 }, config: { scene_id: missingScene } },
					],
					edges: [{ id: 'e1', source: 'at', source_port: 'out', target: 'scene', target_port: 'in' }],
				},
			} as unknown as CreateAutomationDto);

			await settled();

			expect(engine.runtime(automation.id)).toMatchObject({ status: 'invalid', armed: false });
			expect(engine.runtime(automation.id)?.problems).toEqual([expect.objectContaining({ node_id: 'scene' })]);
			// An automation that is not armed holds no time trigger
			expect(timeSource.subscriptionCount()).toBe(0);

			await automationsService.remove(automation.id);
			await settled();
		});

		describe('safety', () => {
			let scenesService: ScenesService;
			let sceneActionsService: SceneActionsService;

			let lockStatus: Target;
			let alarmState: Target;
			let doorPosition: Target;

			const safetyDevice = (
				category: DeviceCategory,
				channel: ChannelCategory,
				property: PropertyCategory,
				format: string[],
				value: string,
			): Promise<DeviceBody> =>
				createDevice({
					category,
					name: `Front ${channel}`,
					channels: [
						{
							type: SIMULATOR_TYPE,
							category: channel,
							identifier: channel,
							name: channel,
							properties: [
								{
									type: SIMULATOR_TYPE,
									category: property,
									identifier: property,
									name: property,
									permissions: [PermissionType.READ_WRITE],
									data_type: DataTypeType.ENUM,
									format,
									value,
								},
							],
						},
					],
				});

			const sceneAction = (target: Target, value: string | number | boolean) => ({
				type: SCENES_LOCAL_TYPE,
				...target,
				value,
			});

			const createScene = async (name: string, actions: ReturnType<typeof sceneAction>[]): Promise<string> =>
				(await scenesService.create({ name, actions } as unknown as CreateSceneDto)).id;

			const setValue = (id: string, writes: Record<string, unknown>[]) => ({
				id,
				type: 'device.property.set',
				position: { x: 200, y: 0 },
				config: { writes },
			});

			/**
			 * manual start → `action`; its `error` output sets the brightness to `marker`, so a run that took
			 * `error` is told from one that took `done` by what the light shows afterwards
			 */
			const guardedGraph = (action: Record<string, unknown> & { id: string }, marker: number) => ({
				version: 1,
				nodes: [
					{ id: 'start', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
					action,
					setValue('refused', [{ ...lightBrightness, value: marker }]),
				],
				edges: [
					{ id: 'e1', source: 'start', source_port: 'out', target: action.id, target_port: 'in' },
					{ id: 'e2', source: action.id, source_port: 'error', target: 'refused', target_port: 'in' },
				],
			});

			const runScene = (sceneId: string) => ({
				id: 'scene',
				type: 'scene.run',
				position: { x: 200, y: 0 },
				config: { scene_id: sceneId },
			});

			const createAutomation = async (name: string, graph: unknown): Promise<string> => {
				const automation = await automationsService.create({
					name,
					enabled: true,
					graph,
				} as unknown as CreateAutomationDto);

				await settled();

				expect(engine.runtime(automation.id)).toMatchObject({ status: 'ok', armed: true });

				return automation.id;
			};

			const runOnce = async (id: string): Promise<string | null> => {
				await afterRuns(id, 1, async () => {
					await engine.triggerOrThrow(id);
				});

				return (await automationsService.getOneOrThrow(id)).lastRunStatus;
			};

			const remove = async (id: string): Promise<void> => {
				await automationsService.remove(id);
				await settled();
			};

			beforeAll(async () => {
				scenesService = app.get(ScenesService, { strict: false });
				sceneActionsService = app.get(SceneActionsService, { strict: false });

				const lock = await safetyDevice(
					DeviceCategory.LOCK,
					ChannelCategory.LOCK,
					PropertyCategory.STATUS,
					['locked', 'unlocked'],
					'locked',
				);
				const alarm = await safetyDevice(
					DeviceCategory.ALARM,
					ChannelCategory.ALARM,
					PropertyCategory.STATE,
					['disarmed', 'armed_home', 'armed_away', 'armed_night'],
					'armed_away',
				);
				const door = await safetyDevice(
					DeviceCategory.DOOR,
					ChannelCategory.DOOR,
					PropertyCategory.POSITION,
					['open', 'close', 'stop'],
					'close',
				);

				lockStatus = targetOf(lock, ChannelCategory.LOCK, PropertyCategory.STATUS);
				alarmState = targetOf(alarm, ChannelCategory.ALARM, PropertyCategory.STATE);
				doorPosition = targetOf(door, ChannelCategory.DOOR, PropertyCategory.POSITION);
			}, 60_000);

			/**
			 * Puts the house into a known state and waits until that is what is read back. The value is
			 * commanded, as a person would set it: a value a command has just written is not replaced by a report.
			 */
			const reset = async (target: Target, value: string | number | boolean): Promise<void> => {
				await propertyCommands.executePropertyCommands([{ propertyId: target.property_id, value }]);
				await waitFor(
					() => valueOf(target),
					(seen) => seen === value,
					'a value to be reset',
				);
			};

			beforeEach(async () => {
				await reset(lockStatus, 'locked');
				await reset(alarmState, 'armed_away');
				await reset(doorPosition, 'close');
				await reset(lightOn, false);
				await reset(lightBrightness, 100);
			});

			it('refuses to save an automation that would unlock, disarm or open, node by node, even as a draft', async () => {
				const graph = {
					version: 1,
					nodes: [
						{ id: 'start', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
						setValue('unlock', [
							{ ...lightOn, value: true },
							{ ...lockStatus, value: 'unlocked' },
						]),
						setValue('disarm', [{ ...alarmState, value: 'disarmed' }]),
						setValue('open', [{ ...doorPosition, value: 'open' }]),
						setValue('harmless', [{ ...lightOn, value: false }]),
					],
					edges: ['unlock', 'disarm', 'open', 'harmless'].map((target, index) => ({
						id: `e${index}`,
						source: 'start',
						source_port: 'out',
						target,
						target_port: 'in',
					})),
				};

				const before = (await automationsService.findAll()).length;

				const response = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { name: 'Let everybody in', enabled: false, graph } })
					.expect(422);

				const rejection = response.body as GraphRejectionBody;

				expect(
					rejection.issues.map((issue) => ({
						code: issue.code,
						node_id: issue.node_id,
						field: issue.field,
						message: issue.message,
						blocking: issue.blocking,
					})),
				).toEqual([
					{
						code: 'safety_reducing_action',
						node_id: 'unlock',
						field: 'writes.1.value',
						message: 'An automation can not unlock a lock.',
						blocking: true,
					},
					{
						code: 'safety_reducing_action',
						node_id: 'disarm',
						field: 'writes.0.value',
						message: 'An automation can not disarm the alarm.',
						blocking: true,
					},
					{
						code: 'safety_reducing_action',
						node_id: 'open',
						field: 'writes.0.value',
						message: 'An automation can not open a door, garage or gate.',
						blocking: true,
					},
				]);
				expect((await automationsService.findAll()).length).toBe(before);

				// The editor is told the same before anything is saved
				const validated = await request(app.getHttpServer())
					.post(`${base}/validate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { enabled: false, graph } })
					.expect(200);

				const check = (validated.body as { data: { valid: boolean; issues: IssueBody[] } }).data;

				expect(check.valid).toBe(false);
				expect(check.issues.map((issue) => issue.node_id)).toEqual(['unlock', 'disarm', 'open']);
			});

			it('saves and runs an automation that locks, arms and closes', async () => {
				await reset(lockStatus, 'unlocked');
				await reset(alarmState, 'disarmed');
				await reset(doorPosition, 'open');

				const response = await request(app.getHttpServer())
					.post(base)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({
						data: {
							name: 'Good night',
							enabled: true,
							graph: guardedGraph(
								setValue('secure', [
									{ ...lockStatus, value: 'locked' },
									{ ...alarmState, value: 'armed_night' },
									{ ...doorPosition, value: 'close' },
								]),
								5,
							),
						},
					})
					.expect(201);

				const id = (response.body as { data: AutomationBody }).data.id;

				await settled();

				expect(await runOnce(id)).toBe('completed');
				expect(await valueOf(lockStatus)).toBe('locked');
				expect(await valueOf(alarmState)).toBe('armed_night');
				expect(await valueOf(doorPosition)).toBe('close');
				// The error output was not taken
				expect(await valueOf(lightBrightness)).toBe(100);

				await remove(id);
			});

			it('refuses an unsafe write when the automation runs, whatever was stored: the action takes error', async () => {
				const id = await createAutomation(
					'Front door',
					guardedGraph(setValue('door', [{ ...lockStatus, value: 'locked' }]), 7),
				);

				// A graph that reached the store without passing the save check, as one written before the rule
				// existed would have: the engine takes it as any other save
				const repository = app.get<Repository<AutomationEntity>>(getRepositoryToken(AutomationEntity), {
					strict: false,
				});
				const stored = await repository.findOneByOrFail({ id });

				await repository.update(
					{ id },
					{
						revision: stored.revision + 1,
						graph: guardedGraph(
							setValue('door', [
								{ ...lightOn, value: true },
								{ ...lockStatus, value: 'unlocked' },
							]),
							7,
						) as unknown as AutomationEntity['graph'],
					},
				);
				app
					.get(EventEmitter2, { strict: false })
					.emit(AutomationsEventType.AUTOMATION_UPDATED, await repository.findOneByOrFail({ id }));
				await settled();

				expect(engine.runtime(id)).toMatchObject({ status: 'ok', armed: true, revision: stored.revision + 1 });

				const commands = jest.spyOn(propertyCommands, 'executePropertyCommands');

				try {
					// The refusal was handled by the error output, so the run completed
					expect(await runOnce(id)).toBe('completed');

					// Nothing of the refused action was dispatched: neither the lock nor the light next to it
					expect(await valueOf(lockStatus)).toBe('locked');
					expect(await valueOf(lightOn)).toBe(false);
					expect(await valueOf(lightBrightness)).toBe(7);
					expect(commands.mock.calls.flatMap(([writes]) => writes.map((write) => write.propertyId))).toEqual([
						lightBrightness.property_id,
					]);
				} finally {
					commands.mockRestore();
				}

				await remove(id);
			});

			it('does not run a scene that would unlock; the same scene run by hand still does', async () => {
				const sceneId = await createScene('Come in', [sceneAction(lightOn, true), sceneAction(lockStatus, 'unlocked')]);
				const graph = guardedGraph(runScene(sceneId), 9);

				// Saving is not refused - the scene is judged when it is run - but the editor is warned
				const validated = await request(app.getHttpServer())
					.post(`${base}/validate`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { enabled: true, graph } })
					.expect(200);

				const check = (validated.body as { data: { valid: boolean; issues: IssueBody[] } }).data;

				expect(check.valid).toBe(true);
				expect(check.issues).toEqual([
					expect.objectContaining({
						severity: 'warning',
						code: 'safety_reducing_action',
						node_id: 'scene',
						field: 'scene_id',
						blocking: false,
					}),
				]);

				const id = await createAutomation('Welcome', graph);

				expect(await runOnce(id)).toBe('completed');

				// The whole scene was refused: not even its harmless action ran, and the error output was taken
				expect(await valueOf(lockStatus)).toBe('locked');
				expect(await valueOf(lightOn)).toBe(false);
				expect(await valueOf(lightBrightness)).toBe(9);
				expect((await scenesService.getOneOrThrow(sceneId)).lastTriggeredAt).toBeNull();

				// A person may: the scene run from the admin or the panel is unchanged
				const manual = await request(app.getHttpServer())
					.post(`/modules/scenes/scenes/${sceneId}/trigger`)
					.set('Authorization', `Bearer ${ownerToken}`)
					.send({ data: { source: 'manual' } })
					.expect(201);

				expect((manual.body as { data: { status: string; failed_actions: number } }).data).toMatchObject({
					status: 'completed',
				});
				expect(await valueOf(lockStatus)).toBe('unlocked');
				expect(await valueOf(lightOn)).toBe(true);

				await remove(id);
				await scenesService.remove(sceneId);
			});

			it('judges a scene as it is when it is run: one edited after the automation was saved is refused', async () => {
				const sceneId = await createScene('Evening', [sceneAction(lightOn, true)]);
				const id = await createAutomation('Evening scene', guardedGraph(runScene(sceneId), 11));

				expect(await runOnce(id)).toBe('completed');
				expect(await valueOf(lightOn)).toBe(true);
				expect(await valueOf(lightBrightness)).toBe(100);

				// The scene is edited; the automation is not saved again
				const revision = (await automationsService.getOneOrThrow(id)).revision;

				await sceneActionsService.create({
					...sceneAction(alarmState, 'disarmed'),
					scene: sceneId,
				} as unknown as Parameters<SceneActionsService['create']>[0]);
				await reset(lightOn, false);

				expect(await runOnce(id)).toBe('completed');

				expect(await valueOf(alarmState)).toBe('armed_away');
				expect(await valueOf(lightOn)).toBe(false);
				expect(await valueOf(lightBrightness)).toBe(11);
				expect((await automationsService.getOneOrThrow(id)).revision).toBe(revision);

				await remove(id);
				await scenesService.remove(sceneId);
			});

			it('fails a run whose refusal nothing handles', async () => {
				const sceneId = await createScene('Garage', [sceneAction(doorPosition, 'open')]);
				const id = await createAutomation('Open up', {
					version: 1,
					nodes: [{ id: 'start', type: 'manual.start', position: { x: 0, y: 0 }, config: {} }, runScene(sceneId)],
					edges: [{ id: 'e1', source: 'start', source_port: 'out', target: 'scene', target_port: 'in' }],
				});

				expect(await runOnce(id)).toBe('failed');
				expect(await valueOf(doorPosition)).toBe('close');

				await remove(id);
				await scenesService.remove(sceneId);
			});
		});
	});

	describe('as a display', () => {
		const asDisplay = (call: request.Test): request.Test => call.set('Authorization', `Bearer ${displayToken}`);

		// The throttler allows 30 requests a minute per route, so the automations are set up and checked in process
		const service = (): AutomationsService => app.get(AutomationsService, { strict: false });
		const stored = (): Promise<AutomationEntity | null> => service().findOne(id);

		let id: string;

		beforeEach(async () => {
			id = (await service().create({ name: 'Panel switch', graph: completeGraph } as unknown as CreateAutomationDto))
				.id;
		});

		afterEach(async () => {
			await service().remove(id);
		});

		it('lists automations without their graphs', async () => {
			const response = await asDisplay(request(app.getHttpServer()).get(base)).expect(200);
			const row = (response.body as { data: AutomationBody[] }).data.find((automation) => automation.id === id);

			expect(row).toMatchObject({ name: 'Panel switch', enabled: false, space_id: null, status: 'ok' });
			expect(row).not.toHaveProperty('graph');
		});

		it('switches an automation on and off without a revision and announces each change', async () => {
			const emit = jest.spyOn(app.get(EventEmitter2), 'emit');

			try {
				const on = await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
					.send({ data: { enabled: true } })
					.expect(200);

				expect((on.body as { data: AutomationBody }).data).toMatchObject({ id, enabled: true, revision: 2 });
				expect((on.body as { data: AutomationBody }).data).not.toHaveProperty('graph');
				expect(emit).toHaveBeenCalledWith(
					AutomationsEventType.AUTOMATION_UPDATED,
					expect.objectContaining({ id, enabled: true }),
				);

				const off = await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
					.send({ data: { enabled: false } })
					.expect(200);

				expect((off.body as { data: AutomationBody }).data).toMatchObject({ enabled: false, revision: 3 });
			} finally {
				emit.mockRestore();
			}

			// The graph was not touched
			expect(await stored()).toMatchObject({
				name: 'Panel switch',
				enabled: false,
				revision: 3,
				graph: completeGraph,
			});
		});

		it('refuses any other field on the enabled route', async () => {
			await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
				.send({ data: { enabled: true, name: 'Renamed' } })
				.expect(400);
			await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
				.send({ data: { enabled: true, graph: draftGraph } })
				.expect(400);
			await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
				.send({ data: {} })
				.expect(400);

			expect(await stored()).toMatchObject({ name: 'Panel switch', enabled: false, revision: 1 });
		});

		it.each<[string, unknown]>([
			['the string "false"', 'false'],
			['the string "true"', 'true'],
			['1', 1],
			['0', 0],
			['null', null],
		])('refuses %s for enabled and changes nothing', async (_label, enabled) => {
			await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}/enabled`))
				.send({ data: { enabled } })
				.expect(400);

			expect(await stored()).toMatchObject({ enabled: false, revision: 1 });
		});

		it('cannot enable an automation whose graph is not complete', async () => {
			const draftId = (
				await service().create({ name: 'Panel draft', graph: draftGraph } as unknown as CreateAutomationDto)
			).id;

			try {
				await asDisplay(request(app.getHttpServer()).patch(`${base}/${draftId}/enabled`))
					.send({ data: { enabled: true } })
					.expect(422);
			} finally {
				await service().remove(draftId);
			}
		});

		it('cannot read the graph, edit, run or delete the automation', async () => {
			await asDisplay(request(app.getHttpServer()).get(`${base}/${id}`)).expect(403);
			await asDisplay(request(app.getHttpServer()).patch(`${base}/${id}`))
				.send({ data: { revision: 1, enabled: true } })
				.expect(403);
			await asDisplay(request(app.getHttpServer()).post(`${base}/${id}/trigger`))
				.send({})
				.expect(403);
			await asDisplay(request(app.getHttpServer()).delete(`${base}/${id}`)).expect(403);

			expect(await stored()).toMatchObject({ enabled: false, revision: 1 });
		});

		it('lets the owner use the enabled route as well, but not a plain user', async () => {
			await request(app.getHttpServer())
				.patch(`${base}/${id}/enabled`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { enabled: true } })
				.expect(200);
			await request(app.getHttpServer())
				.patch(`${base}/${id}/enabled`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ data: { enabled: false } })
				.expect(403);
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
				'GET /templates',
				(token) => authorize(request(app.getHttpServer()).get('/modules/automations/templates'), token),
			],
			[
				'POST /templates/:id/generate',
				(token) =>
					authorize(
						request(app.getHttpServer()).post('/modules/automations/templates/leak-alarm/generate'),
						token,
					).send({
						data: { parameters: {} },
					}),
			],
			[
				'PATCH /automations/:id/enabled',
				(token) =>
					authorize(request(app.getHttpServer()).patch(`${base}/${placeholderId}/enabled`), token).send({
						data: { enabled: true },
					}),
			],
			[
				'POST /automations/:id/trigger',
				(token) => authorize(request(app.getHttpServer()).post(`${base}/${placeholderId}/trigger`), token).send({}),
			],
			[
				'GET /automations/:id/runtime',
				(token) => authorize(request(app.getHttpServer()).get(`${base}/${placeholderId}/runtime`), token),
			],
			[
				'GET /automations/:id/runs',
				(token) => authorize(request(app.getHttpServer()).get(`${base}/${placeholderId}/runs`), token),
			],
			[
				'GET /runs/:runId',
				(token) => authorize(request(app.getHttpServer()).get(`${runsBase}/${placeholderId}`), token),
			],
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

		// The wall panel lists automations and switches them on or off; everything else stays closed to it
		const displayCalls = ['GET /automations', 'PATCH /automations/:id/enabled'];

		it.each(calls.filter(([label]) => !displayCalls.includes(label)))(
			'%s is 403 for a display token',
			async (_label, call) => {
				await call(displayToken).expect(403);
			},
		);

		it('lets a display token through to the panel routes', async () => {
			const [list, enabled] = displayCalls.map((label) => calls.find(([name]) => name === label)[1]);

			await list(displayToken).expect(200);
			// Past the guards: the placeholder id does not exist
			await enabled(displayToken).expect(404);
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
