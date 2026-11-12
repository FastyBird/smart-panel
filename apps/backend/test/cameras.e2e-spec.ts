import { useContainer } from 'class-validator';
import request from 'supertest';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { CameraSessionService } from '../src/modules/cameras/services/camera-session.service';
import { CameraSnapshotService } from '../src/modules/cameras/services/camera-snapshot.service';
import { CameraStreamProviderRegistryService } from '../src/modules/cameras/services/camera-stream-provider.registry.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { UserRole } from '../src/modules/users/users.constants';
import {
	DEVICES_THIRD_PARTY_PLUGIN_PREFIX,
	DEVICES_THIRD_PARTY_TYPE,
} from '../src/plugins/devices-third-party/devices-third-party.constants';
import { DevicesThirdPartyPlugin } from '../src/plugins/devices-third-party/devices-third-party.plugin';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from './support/fake-camera-stream.provider';

describe('Cameras module (e2e)', () => {
	let app: NestFastifyApplication;
	let ownerToken: string;
	let userToken: string;
	let displayToken: string;
	let cameraId: string;
	let lightId: string;
	let provider: FakeCameraStreamProvider;
	let snapshots: CameraSnapshotService;
	let sessions: CameraSessionService;
	let logSpies: jest.SpyInstance[];

	const api = '/api/v1';
	const base = `${api}/modules/cameras/cameras`;
	const url = (suffix = '') => `${base}${suffix}`;
	const get = (path: string, token: string | null) => {
		const req = request(app.getHttpServer()).get(path);

		return token ? req.set('Authorization', `Bearer ${token}`) : req;
	};
	const postSession = (id: string, data: Record<string, unknown>) =>
		request(app.getHttpServer())
			.post(url(`/${id}/sessions`))
			.set('Authorization', `Bearer ${userToken}`)
			.send({ data });

	const property = (category: PropertyCategory, dataType: DataTypeType, value: unknown, format?: unknown[]) => ({
		type: DEVICES_THIRD_PARTY_TYPE,
		category,
		identifier: category,
		name: category,
		permissions: [PermissionType.READ_ONLY],
		data_type: dataType,
		...(format ? { format } : {}),
		value,
	});

	const createDevice = async (body: Record<string, unknown>): Promise<string> => {
		const response = await request(app.getHttpServer())
			.post(`${api}/modules/devices/devices`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { type: DEVICES_THIRD_PARTY_TYPE, service_address: 'http://127.0.0.1:9999', ...body } });

		const id = (response.body as { data?: { id?: string } }).data?.id;

		if (!id) {
			throw new Error(`E2E setup failed: device creation ${response.status} ${JSON.stringify(response.body)}`);
		}

		return id;
	};

	const channel = (category: ChannelCategory, properties: unknown[]) => ({
		type: DEVICES_THIRD_PARTY_TYPE,
		category,
		name: category,
		properties,
	});

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AppModule.register({
					moduleExtensions: [],
					pluginExtensions: [
						{ routePrefix: DEVICES_THIRD_PARTY_PLUGIN_PREFIX, extensionClass: DevicesThirdPartyPlugin },
					],
				}),
			],
		}).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		// Mirror the production wiring of main.ts so error responses have their real shape.
		app.useGlobalFilters(...createGlobalExceptionFilters(moduleFixture.get(ConfigService)));
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: true },
				exceptionFactory: (errors) => ValidationExceptionFactory.createException(errors),
			}),
		);
		app.setGlobalPrefix('api');
		app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		await new Promise((resolve) => setTimeout(resolve, 100));

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'camowner', password: 'securePassword123!', email: 'camowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'camowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		await request(app.getHttpServer())
			.post(`${api}/modules/users/users`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'camuser',
					password: 'securePassword123!',
					email: 'camuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'camuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;

		const displayRegister = await request(app.getHttpServer())
			.post(`${api}/modules/displays/register`)
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

		cameraId = await createDevice({
			category: DeviceCategory.CAMERA,
			name: 'Front door camera',
			channels: [
				channel(ChannelCategory.CAMERA, [
					property(PropertyCategory.STATUS, DataTypeType.ENUM, 'available', [
						'available',
						'in_use',
						'unavailable',
						'offline',
						'initializing',
						'error',
					]),
					property(PropertyCategory.SOURCE, DataTypeType.STRING, 'main'),
				]),
				channel(ChannelCategory.DEVICE_INFORMATION, [
					property(PropertyCategory.MANUFACTURER, DataTypeType.STRING, 'Fake'),
					property(PropertyCategory.MODEL, DataTypeType.STRING, 'F1'),
					property(PropertyCategory.SERIAL_NUMBER, DataTypeType.STRING, 'SN1'),
				]),
			],
		});

		lightId = await createDevice({
			category: DeviceCategory.LIGHTING,
			name: 'Hall light',
			channels: [
				channel(ChannelCategory.LIGHT, [property(PropertyCategory.ON, DataTypeType.BOOL, false)]),
				channel(ChannelCategory.DEVICE_INFORMATION, [
					property(PropertyCategory.MANUFACTURER, DataTypeType.STRING, 'Fake'),
					property(PropertyCategory.MODEL, DataTypeType.STRING, 'L1'),
					property(PropertyCategory.SERIAL_NUMBER, DataTypeType.STRING, 'SN2'),
				]),
			],
		});

		provider = new FakeCameraStreamProvider(DEVICES_THIRD_PARTY_TYPE);
		app.get(CameraStreamProviderRegistryService).register(provider);
		snapshots = app.get(CameraSnapshotService);
		sessions = app.get(CameraSessionService);
	}, 120_000);

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		provider.mode = 'ok';
		provider.snapshotCalls = 0;
		snapshots.evict(cameraId);
	});

	afterEach(() => {
		logSpies?.forEach((spy) => spy.mockRestore());
		logSpies = [];
	});

	it('lists the camera with its profiles and no stream url', async () => {
		const response = await get(url(), userToken).expect(200);
		const data = (response.body as { data: Array<Record<string, unknown>> }).data;

		expect(data).toHaveLength(1);
		expect(data[0]).toMatchObject({ device_id: cameraId, live_view: true });
		expect((data[0].profiles as Array<{ id: string }>).map((p) => p.id)).toEqual(['medium', 'high']);
		expect(JSON.stringify(response.body)).not.toContain('rtsp');
	});

	it('rejects an unauthenticated request', async () => {
		await get(url(), null).expect(401);
	});

	it('answers 404 for a device that is not a camera', async () => {
		await get(url(`/${lightId}`), userToken).expect(404);
	});

	it('serves a snapshot to a display', async () => {
		const response = await get(url(`/${cameraId}/snapshot`), displayToken)
			.buffer(true)
			.parse((res, cb) => {
				const chunks: Buffer[] = [];

				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => cb(null, Buffer.concat(chunks)));
			})
			.expect(200);

		expect(response.headers['content-type']).toContain('image/jpeg');
		expect(response.headers['cache-control']).toBe('no-store');
		expect(response.headers['x-snapshot-age']).toBeUndefined();
		expect((response.body as Buffer).subarray(0, 2).toString('hex')).toBe('ffd8');
	});

	it('shares one provider call between parallel snapshot requests', async () => {
		const responses = await Promise.all(
			Array.from({ length: 5 }, () => get(url(`/${cameraId}/snapshot`), displayToken)),
		);

		responses.forEach((response) => expect(response.status).toBe(200));
		expect(provider.snapshotCalls).toBe(1);
	});

	it('answers 503 with the error envelope when the camera is offline', async () => {
		provider.mode = 'offline';

		const response = await get(url(`/${cameraId}/snapshot`), userToken).expect(503);

		expect(response.headers['content-type']).toContain('application/json');
		expect(response.body).toMatchObject({ statusCode: 503, message: 'Camera is offline' });
	});

	it('returns the last image with an age header when the camera is rate limited', async () => {
		await get(url(`/${cameraId}/snapshot`), userToken).expect(200);

		provider.mode = 'rate_limited';

		await new Promise((resolve) => setTimeout(resolve, 2100));

		const response = await get(url(`/${cameraId}/snapshot`), userToken).expect(200);

		expect(response.headers['x-snapshot-age']).toBeDefined();
	});

	it('creates a session for a user', async () => {
		const response = await postSession(cameraId, { transport: 'mse' }).expect(201);

		expect((response.body as { data: { url: string } }).data.url).toMatch(
			/^\/api\/v1\/modules\/cameras\/live\?session=[A-Za-z0-9_-]{43}$/,
		);
	});

	it('answers 404 for an unavailable profile', async () => {
		await postSession(cameraId, { transport: 'mse', profile: 'high' }).expect(404);
	});

	it('rejects an unsupported transport as invalid input', async () => {
		await postSession(cameraId, { transport: 'webrtc' }).expect(400);
	});

	it('revokes sessions when the device is deleted', async () => {
		const response = await postSession(cameraId, { transport: 'mse' }).expect(201);
		const token = (response.body as { data: { url: string } }).data.url.split('session=')[1];

		await request(app.getHttpServer())
			.delete(`${api}/modules/devices/devices/${cameraId}`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.expect(204);

		expect(sessions.consume(token)).toBeNull();
	});

	describe('secret hygiene', () => {
		it('never leaks the source url from a failing provider', async () => {
			const freshCameraId = await createDevice({
				category: DeviceCategory.CAMERA,
				name: 'Back camera',
				channels: [
					channel(ChannelCategory.CAMERA, [
						property(PropertyCategory.STATUS, DataTypeType.ENUM, 'available', ['available', 'offline']),
						property(PropertyCategory.SOURCE, DataTypeType.STRING, 'main'),
					]),
					channel(ChannelCategory.DEVICE_INFORMATION, [
						property(PropertyCategory.MANUFACTURER, DataTypeType.STRING, 'Fake'),
						property(PropertyCategory.MODEL, DataTypeType.STRING, 'F2'),
						property(PropertyCategory.SERIAL_NUMBER, DataTypeType.STRING, 'SN3'),
					]),
				],
			});

			provider.mode = 'throw_with_secret';

			logSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
				jest.spyOn(Logger.prototype, m).mockImplementation(),
			);

			const responses = [
				await get(url(`/${freshCameraId}`), userToken),
				await get(url(`/${freshCameraId}/snapshot`), userToken),
				await postSession(freshCameraId, { transport: 'mse' }),
			];

			expect(responses.map((r) => r.status)).toEqual([200, 503, 503]);

			const emitted = JSON.stringify([
				logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]),
				responses.map((r): unknown[] => [r.body, r.headers, r.text]),
			]);

			expect(emitted).not.toContain('SENTINELALIAS');
			expect(emitted).not.toContain('fake-console:7441');
			expect(FAKE_CAMERA_SECRET_URL).toContain('SENTINELALIAS');
		});
	});
});
