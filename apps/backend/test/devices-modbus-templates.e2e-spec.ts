/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: supertest types HTTP response bodies as `any`; the bodies are narrowed to the local interfaces below, the
same pattern the other e2e specs in this directory use.
*/
import { useContainer } from 'class-validator';
import { ServerTCP } from 'modbus-serial';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { PropertyCategory } from '../src/modules/devices/devices.constants';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { ModbusFraming } from '../src/plugins/devices-modbus/devices-modbus.constants';

const POLL_INTERVAL_MS = 200;
const REQUEST_TIMEOUT_MS = 300;
const LIVE_SAMPLE_MAX_AGE_MS = 60_000;
const QINGJUN_DEFINITION = join(__dirname, '../src/plugins/devices-modbus/templates/definitions/qingjun-32di.yaml');

interface TemplateSummary {
	id: string;
	name: string;
	source: string;
	revision: string;
	overrides_builtin: boolean;
}

interface Catalog {
	templates: TemplateSummary[];
	files: { path: string; errors: string[] }[];
}

interface DeviceBody {
	id: string;
	template_id: string | null;
	template_revision: string | null;
}

/** Picks a currently free loopback TCP port. `ServerTCP` treats port 0 as "use 502", so it cannot pick one itself. */
const freePort = (): Promise<number> =>
	new Promise((resolve, reject) => {
		const probe = createServer();

		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();

			probe.close(() => {
				if (address && typeof address === 'object') {
					resolve(address.port);
				} else {
					reject(new Error('Could not resolve a free port'));
				}
			});
		});
	});

/** Modbus TCP server holding registers; unset registers read 0. */
class RegisterSimulator {
	readonly registers = new Map<number, number>();

	private server: ServerTCP | null = null;

	constructor(readonly port: number) {}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const server = new ServerTCP(
				{
					getHoldingRegister: (address: number): number => this.registers.get(address) ?? 0,
					getMultipleHoldingRegisters: (address: number, length: number): number[] =>
						Array.from({ length }, (_, index) => this.registers.get(address + index) ?? 0),
				},
				{ host: '127.0.0.1', port: this.port, unitID: 1 },
			);

			server.on('initialized', () => resolve());
			server.on('serverError', (error: Error | null) => reject(error ?? new Error('Modbus server failed')));
			server.on('socketError', () => undefined);

			this.server = server;
		});
	}

	stop(): Promise<void> {
		const server = this.server;

		this.server = null;

		return server ? new Promise((resolve) => server.close(() => resolve())) : Promise.resolve();
	}
}

async function waitFor<T>(
	label: string,
	check: () => Promise<T | undefined>,
	timeoutMs: number,
	intervalMs = 50,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let lastError = 'none';

	for (;;) {
		try {
			const value = await check();

			if (value !== undefined) {
				return value;
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : JSON.stringify(error);
		}

		if (Date.now() >= deadline) {
			throw new Error(`waitFor: ${label} was not met within ${timeoutMs}ms (last error: ${lastError})`);
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

describe('devices-modbus templates (e2e)', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let accessToken: string;
	let simulator: RegisterSimulator;
	let templatesDirectory: string;
	let previousTemplatesPath: string | undefined;
	let endpointId: string;
	let device: DeviceBody;
	let builtinRevision: string;

	const authGet = (path: string) =>
		request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	const authPost = (path: string) =>
		request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);
	const authPatch = (path: string) =>
		request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${accessToken}`);

	/** Reads a `di_*` state in-process (HTTP polling would exhaust the throttler); `undefined` until a live sample exists. */
	const inputState = async (identifier: string): Promise<unknown> => {
		const entity = await moduleRef.get(DevicesService).getOneOrThrow(device.id);
		const property = entity.channels
			?.find((channel) => channel.identifier === identifier)
			?.properties?.find((candidate) => candidate.category === PropertyCategory.STATE);

		if (!property) {
			throw new Error(`${identifier} has no state property`);
		}

		return moduleRef.get(PropertyValueService).readQualifiedSample(property, LIVE_SAMPLE_MAX_AGE_MS)?.value;
	};

	beforeAll(async () => {
		previousTemplatesPath = process.env.FB_MODBUS_TEMPLATES_PATH;
		templatesDirectory = mkdtempSync(join(tmpdir(), 'modbus-templates-'));
		process.env.FB_MODBUS_TEMPLATES_PATH = templatesDirectory;

		simulator = new RegisterSimulator(await freePort());

		await simulator.start();

		moduleRef = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleRef.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(moduleRef, { fallbackOnErrors: true });

		await app.listen(0, '127.0.0.1');

		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'tpltest', password: 'securePassword123!', email: 'tpltest@example.com' } });

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'tpltest', password: 'securePassword123!' } });
		const token = (login.body as { data?: { access_token?: string } }).data?.access_token;

		if (!token) {
			throw new Error(`E2E setup failed: login returned ${login.status} — ${JSON.stringify(login.body)}`);
		}

		accessToken = token;
	}, 60_000);

	afterAll(async () => {
		await app?.close();
		await simulator?.stop();

		if (previousTemplatesPath === undefined) {
			delete process.env.FB_MODBUS_TEMPLATES_PATH;
		} else {
			process.env.FB_MODBUS_TEMPLATES_PATH = previousTemplatesPath;
		}

		rmSync(templatesDirectory, { recursive: true, force: true });
	});

	it('lists the built-in templates without load errors', async () => {
		const response = await authGet('/plugins/devices-modbus/templates').expect(200);
		const catalog = (response.body as { data: Catalog }).data;

		expect(catalog.templates.map((template) => template.id)).toEqual(
			expect.arrayContaining(['qingjun-32di', 'eletechsup-n4d8b08']),
		);
		expect(catalog.files.length).toBeGreaterThan(0);

		for (const file of catalog.files) {
			expect(file.errors).toEqual([]);
		}

		builtinRevision = catalog.templates.find((template) => template.id === 'qingjun-32di')?.revision ?? '';

		const single = await authGet('/plugins/devices-modbus/templates/qingjun-32di').expect(200);

		expect((single.body as { data: TemplateSummary }).data.source).toBe('builtin');

		await authGet('/plugins/devices-modbus/templates/missing').expect(404);
	});

	it('refuses a preview with a unit outside the range the template allows', async () => {
		const response = await authPost('/plugins/devices-modbus/templates/qingjun-32di/preview')
			.send({ data: { unit_id: 32 } })
			.expect(400);

		expect(JSON.stringify(response.body)).toContain('unit_id');
	});

	it('creates a device from a preview and polls the template bindings', async () => {
		const endpointResponse = await authPost('/plugins/devices-modbus/endpoints')
			.send({
				data: {
					name: 'Input board gateway',
					host: '127.0.0.1',
					port: simulator.port,
					framing: ModbusFraming.TCP,
					connect_timeout_ms: 500,
					request_timeout_ms: REQUEST_TIMEOUT_MS,
				},
			})
			.expect(201);

		endpointId = (endpointResponse.body as { data: { id: string } }).data.id;

		const previewResponse = await authPost('/plugins/devices-modbus/templates/qingjun-32di/preview')
			.send({ data: { unit_id: 1, poll_interval_ms: POLL_INTERVAL_MS } })
			.expect(200);
		const { endpoint_defaults: endpointDefaults, ...preview } = (
			previewResponse.body as { data: { endpoint_defaults: unknown; template_revision: string; channels: unknown[] } }
		).data;

		expect(endpointDefaults).toEqual({ framing: ModbusFraming.TCP, port: 8080 });
		expect(preview.template_revision).toBe(builtinRevision);
		expect(preview.channels).toHaveLength(32);

		simulator.registers.set(4, 0x0001);
		simulator.registers.set(5, 0x8000);

		const created = await authPost('/plugins/devices-modbus/devices')
			.send({ data: { ...preview, name: 'Inputs', endpoint_id: endpointId } })
			.expect(201);

		device = (created.body as { data: DeviceBody }).data;

		expect(device.template_id).toBe('qingjun-32di');
		expect(device.template_revision).toBe(builtinRevision);

		await waitFor(
			'inputs polled',
			async () => ((await inputState('di_1')) === true && (await inputState('di_32')) === true ? true : undefined),
			8000,
		);

		expect(await inputState('di_2')).toBe(false);
	});

	it('reloads a user override and keeps the revision recorded on existing devices', async () => {
		writeFileSync(
			join(templatesDirectory, 'override.yaml'),
			readFileSync(QINGJUN_DEFINITION, 'utf8').replace(
				'name: Qingjun 32-channel digital input board',
				'name: Qingjun (site copy)',
			),
		);

		const response = await authPost('/plugins/devices-modbus/templates/reload').expect(200);
		const catalog = (response.body as { data: Catalog }).data;
		const overridden = catalog.templates.find((template) => template.id === 'qingjun-32di');

		expect(overridden).toMatchObject({ source: 'user', overrides_builtin: true, name: 'Qingjun (site copy)' });
		expect(overridden?.revision).not.toBe(builtinRevision);

		const entity = (await moduleRef.get(DevicesService).getOneOrThrow(device.id)) as unknown as {
			templateRevision: string;
		};

		expect(entity.templateRevision).toBe(builtinRevision);
	});

	it('PATCH cannot change template provenance', async () => {
		// The validation pipe runs with `forbidNonWhitelisted`, so the removed fields are refused rather than ignored.
		for (const field of [{ template_id: 'other' }, { template_revision: 'other' }]) {
			const refused = await authPatch(`/modules/devices/devices/${device.id}`)
				.send({ data: { type: 'devices-modbus', ...field } })
				.expect(400);

			expect(JSON.stringify(refused.body)).toContain(Object.keys(field)[0]);
		}

		const entity = (await moduleRef.get(DevicesService).getOneOrThrow(device.id)) as unknown as {
			templateId: string;
			templateRevision: string;
		};

		expect(entity.templateId).toBe('qingjun-32di');
		expect(entity.templateRevision).toBe(builtinRevision);
	});

	it('refuses a device from a template that is not loaded', async () => {
		const response = await authPost('/plugins/devices-modbus/devices')
			.send({
				data: {
					name: 'Ghost',
					category: 'sensor',
					endpoint_id: endpointId,
					unit_id: 2,
					template_id: 'missing',
					template_revision: 'abc',
					channels: [
						{
							identifier: 'di_1',
							name: 'DI 1',
							category: 'binary_input',
							properties: [
								{
									category: 'state',
									data_type: 'bool',
									permissions: ['ro'],
									read: { register_type: 'holding_register', address: 4, data_type: 'bool', bit: 0 },
								},
							],
						},
					],
				},
			})
			.expect(400);

		expect(JSON.stringify(response.body)).toContain('template_id');
	});
});
