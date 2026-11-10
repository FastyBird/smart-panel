/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: supertest types HTTP response bodies as `any`; the bodies are narrowed to the local interfaces below, the
same pattern the other e2e specs in this directory use.
*/
import { useContainer } from 'class-validator';
import { ServerTCP } from 'modbus-serial';
import { createServer } from 'node:net';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { UserRole } from '../src/modules/users/users.constants';
import {
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
} from '../src/plugins/devices-modbus/devices-modbus.constants';

const REQUEST_TIMEOUT_MS = 300;
/** Holding register that the simulator refuses with an "illegal data address" exception. */
const ILLEGAL_REGISTER = 5;
const BASE = '/plugins/devices-modbus';

interface ProbeError {
	kind: string;
	exception_code: number | null;
	message: string;
}

interface ReadBody {
	ok: boolean;
	values: (number | boolean)[] | null;
	error: ProbeError | null;
	duration_ms: number;
}

interface PointsBody {
	ok: boolean;
	points: { key: string; raw: unknown[] | null; value: string | number | boolean | null; error: ProbeError | null }[];
}

/** The `field` names of a 400 body; the exception filter that reshapes them lives in the app bootstrap, not in the test app. */
const fieldsOf = (body: unknown): string[] => {
	const message = (body as { message?: unknown }).message;

	return (Array.isArray(message) ? (message as string[]) : []).map(
		(entry) => (JSON.parse(entry) as { field: string }).field,
	);
};

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

/** Modbus TCP server whose holding registers 0..9 read 10..19; register 5 answers with an illegal-address exception. */
class RegisterSimulator {
	readonly registers = new Map<number, number>(Array.from({ length: 10 }, (_, index) => [index, 10 + index]));

	private server: ServerTCP | null = null;

	constructor(readonly port: number) {}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const read = (address: number): number => {
				if (address === ILLEGAL_REGISTER || !this.registers.has(address)) {
					throw Object.assign(new Error('Illegal data address'), { modbusErrorCode: 0x02 });
				}

				return this.registers.get(address) ?? 0;
			};
			const server = new ServerTCP(
				{
					getHoldingRegister: read,
					getMultipleHoldingRegisters: (address: number, length: number): number[] =>
						Array.from({ length }, (_, index) => read(address + index)),
					setRegister: (address: number, value: number): void => {
						this.registers.set(address, value);
					},
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

describe('devices-modbus probe (e2e)', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let ownerToken: string;
	let userToken: string;
	let simulator: RegisterSimulator;
	let endpointId: string;

	const post = (path: string, token = ownerToken) =>
		request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);

	const holding = (address: number, extra: Record<string, unknown> = {}) => ({
		register_type: ModbusRegisterType.HOLDING_REGISTER,
		address,
		data_type: ModbusDataType.UINT16,
		...extra,
	});

	const unsaved = () => ({
		host: '127.0.0.1',
		port: simulator.port,
		framing: ModbusFraming.TCP,
		request_timeout_ms: REQUEST_TIMEOUT_MS,
	});

	beforeAll(async () => {
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
			.send({ data: { username: 'probeowner', password: 'securePassword123!', email: 'probeowner@example.com' } });

		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'probeowner', password: 'securePassword123!' } });
		const token = (login.body as { data?: { access_token?: string } }).data?.access_token;

		if (!token) {
			throw new Error(`E2E setup failed: login returned ${login.status} — ${JSON.stringify(login.body)}`);
		}

		ownerToken = token;

		// Self-registration only ever creates the owner, so a USER account is created through the users route.
		await post('/modules/users/users').send({
			data: {
				username: 'probeuser',
				password: 'securePassword123!',
				email: 'probeuser@example.com',
				role: UserRole.USER,
			},
		});

		const userLogin = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'probeuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;
	}, 60_000);

	afterAll(async () => {
		await app?.close();
		await simulator?.stop();
	});

	it('reads registers with unsaved connection details', async () => {
		const response = await post(`${BASE}/probe/read`)
			.send({
				data: { ...unsaved(), unit_id: 1, register_type: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 3 },
			})
			.expect(200);

		expect((response.body as { data: ReadBody }).data).toMatchObject({ ok: true, values: [10, 11, 12], error: null });
	});

	it('reports a device exception as a 200 result', async () => {
		const response = await post(`${BASE}/probe/read`)
			.send({
				data: {
					...unsaved(),
					unit_id: 1,
					register_type: ModbusRegisterType.HOLDING_REGISTER,
					address: ILLEGAL_REGISTER,
					count: 1,
				},
			})
			.expect(200);

		expect((response.body as { data: ReadBody }).data).toMatchObject({
			ok: false,
			values: null,
			error: { kind: 'exception', exception_code: 2 },
		});
	});

	it('reads through a saved endpoint', async () => {
		const created = await post(`${BASE}/endpoints`)
			.send({
				data: {
					name: 'Probe gateway',
					host: '127.0.0.1',
					port: simulator.port,
					framing: ModbusFraming.TCP,
					connect_timeout_ms: 500,
					request_timeout_ms: REQUEST_TIMEOUT_MS,
				},
			})
			.expect(201);

		endpointId = (created.body as { data: { id: string } }).data.id;

		// The runtime connects shortly after the endpoint is created; until then the probe reports `unavailable`.
		const deadline = Date.now() + 10_000;
		let body: ReadBody;

		for (;;) {
			const response = await post(`${BASE}/probe/read`)
				.send({
					data: {
						endpoint_id: endpointId,
						unit_id: 1,
						register_type: ModbusRegisterType.HOLDING_REGISTER,
						address: 0,
						count: 3,
					},
				})
				.expect(200);

			body = (response.body as { data: ReadBody }).data;

			if (body.ok || Date.now() >= deadline) {
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		expect(body).toMatchObject({ ok: true, values: [10, 11, 12] });
	});

	it('refuses a count above the protocol limit', async () => {
		const response = await post(`${BASE}/probe/read`)
			.send({
				data: { ...unsaved(), unit_id: 1, register_type: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 126 },
			})
			.expect(400);

		expect(fieldsOf(response.body)).toEqual(['count']);
	});

	it('refuses unsaved details that equal a saved endpoint', async () => {
		const response = await post(`${BASE}/probe/read`)
			.send({
				data: { ...unsaved(), unit_id: 1, register_type: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 },
			})
			.expect(400);

		expect(fieldsOf(response.body)).toEqual(['host']);
	});

	it('refuses a request with neither or both target forms', async () => {
		const read = { unit_id: 1, register_type: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 };

		for (const target of [{}, { endpoint_id: endpointId, ...unsaved() }]) {
			const response = await post(`${BASE}/probe/read`)
				.send({ data: { ...target, ...read } })
				.expect(400);

			expect(fieldsOf(response.body)).toEqual(['endpoint_id']);
		}
	});

	it('answers 404 for an unknown endpoint', async () => {
		await post(`${BASE}/probe/read`)
			.send({
				data: {
					endpoint_id: '11111111-1111-4111-8111-111111111111',
					unit_id: 1,
					register_type: ModbusRegisterType.HOLDING_REGISTER,
					address: 0,
					count: 1,
				},
			})
			.expect(404);
	});

	it('decodes points with scaling and bit extraction', async () => {
		const response = await post(`${BASE}/probe/points`)
			.send({
				data: {
					endpoint_id: endpointId,
					unit_id: 1,
					points: [
						{ key: 'plain', binding: holding(0) },
						{ key: 'scaled', binding: holding(2, { scale: 0.1 }) },
						{ key: 'flag', binding: holding(1, { data_type: ModbusDataType.BOOL, bit: 0 }) },
					],
				},
			})
			.expect(200);
		const { data } = response.body as { data: PointsBody };
		const byKey = Object.fromEntries(data.points.map((point) => [point.key, point.value]));

		expect(data.ok).toBe(true);
		expect(byKey.plain).toBe(10);
		expect(byKey.scaled).toBeCloseTo(1.2, 10);
		expect(byKey.flag).toBe(true);
	});

	it('writes a register and reads the new value back', async () => {
		const write = await post(`${BASE}/probe/write`)
			.send({ data: { endpoint_id: endpointId, unit_id: 1, binding: holding(7), value: 99 } })
			.expect(200);

		expect((write.body as { data: { ok: boolean; error: unknown } }).data).toMatchObject({ ok: true, error: null });

		const read = await post(`${BASE}/probe/read`)
			.send({
				data: {
					endpoint_id: endpointId,
					unit_id: 1,
					register_type: ModbusRegisterType.HOLDING_REGISTER,
					address: 7,
					count: 1,
				},
			})
			.expect(200);

		expect((read.body as { data: ReadBody }).data).toMatchObject({ ok: true, values: [99] });
	});

	it('refuses a write that would run past the address space', async () => {
		const response = await post(`${BASE}/probe/write`)
			.send({
				data: {
					endpoint_id: endpointId,
					unit_id: 1,
					binding: holding(65535, { data_type: ModbusDataType.UINT32 }),
					value: 1,
				},
			})
			.expect(400);

		expect(fieldsOf(response.body)).toEqual(['address']);
	});

	it.each(['read', 'points', 'write'])('refuses a non-admin user on probe/%s', async (route) => {
		await post(`${BASE}/probe/${route}`, userToken).send({ data: {} }).expect(403);
	});
});
