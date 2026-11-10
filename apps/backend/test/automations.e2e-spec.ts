/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
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

describe('Automations module (e2e)', () => {
	let app: INestApplication;
	let ownerToken: string;
	let adminToken: string;
	let userToken: string;
	let displayToken: string;

	const base = '/modules/automations/automations';

	// Guards run before the route handler even looks the id up, so a well-formed but
	// non-existent id is enough to prove the role denial happens before anything else.
	const placeholderId = '11111111-1111-4111-8111-111111111111';

	const graph = {
		version: 1,
		nodes: [
			{
				id: 'n1',
				type: 'device.property.changed',
				position: { x: 40, y: 80 },
				// Mixed-case keys and nested values: the configuration is opaque and must come back untouched
				config: { property_id: 'p-1', camelCaseKey: true, nested: { list: [1, 'two', { three: 3 }] } },
			},
			{ id: 'n2', type: 'device.property.set', position: { x: 320.5, y: -80 }, config: {} },
		],
		edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
	};

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

	describe('as admin', () => {
		it('can create, list, update and delete automations', async () => {
			const created = await request(app.getHttpServer())
				.post(base)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ data: { name: 'Admin automation' } })
				.expect(201);

			const { id } = (created.body as { data: AutomationBody }).data;

			await request(app.getHttpServer()).get(base).set('Authorization', `Bearer ${adminToken}`).expect(200);
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
