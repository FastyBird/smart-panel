/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
*/
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { StorageService } from '../src/modules/storage/services/storage.service';
import {
	DEVICES_THIRD_PARTY_PLUGIN_PREFIX,
	DEVICES_THIRD_PARTY_TYPE,
} from '../src/plugins/devices-third-party/devices-third-party.constants';
import { DevicesThirdPartyPlugin } from '../src/plugins/devices-third-party/devices-third-party.plugin';

describe('Property Timeseries (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	let channelId: string;
	let propertyId: string;
	let storageMock: Record<string, jest.Mock>;

	beforeAll(async () => {
		// Create a proxy-based mock that auto-stubs any method accessed on StorageService
		const mockFns = new Map<string, jest.Mock>();

		storageMock = new Proxy({} as Record<string, jest.Mock>, {
			get(_target, prop: string | symbol) {
				// Return undefined for symbols and special Promise-detection props
				if (typeof prop === 'symbol' || prop === 'then') {
					return undefined;
				}

				if (!mockFns.has(prop)) {
					mockFns.set(prop, jest.fn().mockResolvedValue(undefined));
				}

				return mockFns.get(prop);
			},
			has() {
				return true;
			},
		});

		// Set specific return values for methods used in tests
		storageMock.query.mockResolvedValue([]);
		storageMock.queryRaw.mockResolvedValue({ results: [] });
		storageMock.isConnected.mockReturnValue(false);

		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [
				{
					routePrefix: DEVICES_THIRD_PARTY_PLUGIN_PREFIX,
					extensionClass: DevicesThirdPartyPlugin,
				},
			],
		});

		const moduleFixture = await Test.createTestingModule({
			imports: [dynamicAppModule],
		})
			.overrideProvider(StorageService)
			.useValue(storageMock)
			.compile();

		app = moduleFixture.createNestApplication();

		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Register and login to obtain an access token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'timeseriestest',
					password: 'securePassword123!',
					email: 'timeseriestest@example.com',
				},
			});

		const loginResponse = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'timeseriestest',
					password: 'securePassword123!',
				},
			});

		const loginBody = loginResponse.body as { data?: { access_token?: string } };

		if (!loginBody.data?.access_token) {
			throw new Error(
				`E2E setup failed: login returned status ${loginResponse.status} — ${JSON.stringify(loginResponse.body)}`,
			);
		}

		accessToken = loginBody.data.access_token;

		// Create a device with a channel and property for timeseries tests
		const deviceResponse = await request(app.getHttpServer())
			.post('/modules/devices/devices')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				data: {
					type: DEVICES_THIRD_PARTY_TYPE,
					category: DeviceCategory.GENERIC,
					name: 'Timeseries Test Device',
					service_address: 'http://127.0.0.1:9999',
					channels: [
						{
							type: DEVICES_THIRD_PARTY_TYPE,
							category: ChannelCategory.GENERIC,
							name: 'Timeseries Test Channel',
							properties: [
								{
									type: DEVICES_THIRD_PARTY_TYPE,
									category: PropertyCategory.GENERIC,
									identifier: 'temperature',
									name: 'Temperature',
									permissions: [PermissionType.READ_ONLY],
									data_type: DataTypeType.FLOAT,
								},
							],
						},
					],
				},
			});

		const deviceBody = deviceResponse.body as {
			data?: { channels?: Array<{ id: string; properties?: Array<{ id: string }> }> };
		};

		if (!deviceBody.data?.channels?.[0]?.id || !deviceBody.data?.channels?.[0]?.properties?.[0]?.id) {
			throw new Error(
				`E2E setup failed: device creation returned status ${deviceResponse.status} — ${JSON.stringify(deviceResponse.body)}`,
			);
		}

		channelId = deviceBody.data.channels[0].id;
		propertyId = deviceBody.data.channels[0].properties[0].id;
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		storageMock.query.mockReset();
		storageMock.query.mockResolvedValue([]);
	});

	// Helper to make authenticated GET requests
	function authGet(path: string) {
		return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	}

	// ─── Timeseries endpoint ────────────────────────────────────────

	function timeseriesUrl(chId: string = channelId, propId: string = propertyId): string {
		return `/modules/devices/channels/${chId}/properties/${propId}/timeseries`;
	}

	describe('GET /modules/devices/channels/:channelId/properties/:id/timeseries', () => {
		it('should return correct response format with empty data', async () => {
			storageMock.query.mockResolvedValue([]);

			const response = await authGet(timeseriesUrl()).expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.data).toHaveProperty('property', propertyId);
			expect(response.body.data).toHaveProperty('from');
			expect(response.body.data).toHaveProperty('to');
			expect(response.body.data).toHaveProperty('bucket');
			expect(response.body.data).toHaveProperty('points');
			expect(response.body.data.points).toBeInstanceOf(Array);
			expect(response.body.data.points).toHaveLength(0);
		});

		it('should return timeseries data with points', async () => {
			storageMock.query.mockResolvedValue([
				{
					time: { _nanoISO: '2025-01-01T10:00:00Z' },
					numberValue: 21.4,
					propertyId,
				},
				{
					time: { _nanoISO: '2025-01-01T10:05:00Z' },
					numberValue: 21.6,
					propertyId,
				},
			]);

			const response = await authGet(timeseriesUrl())
				.query({
					from: '2025-01-01T00:00:00Z',
					to: '2025-01-02T00:00:00Z',
					bucket: '5m',
				})
				.expect(200);

			expect(response.body.data.points).toHaveLength(2);
			expect(response.body.data.points[0]).toHaveProperty('time', '2025-01-01T10:00:00Z');
			expect(response.body.data.points[0]).toHaveProperty('value', 21.4);
			expect(response.body.data.points[1]).toHaveProperty('time', '2025-01-01T10:05:00Z');
			expect(response.body.data.points[1]).toHaveProperty('value', 21.6);
			expect(response.body.data.bucket).toBe('5m');
		});

		it('should support time range filtering with from/to parameters', async () => {
			storageMock.query.mockResolvedValue([]);

			const from = '2025-06-01T00:00:00Z';
			const to = '2025-06-01T12:00:00Z';
			const fromMs = new Date(from).getTime().toString();
			const toMs = new Date(to).getTime().toString();

			await authGet(timeseriesUrl()).query({ from, to }).expect(200);

			expect(storageMock.query).toHaveBeenCalled();

			// Find the timeseries query by matching both time boundaries
			// (entity subscriber queries won't contain these timestamps)
			const calls = storageMock.query.mock.calls;
			const query = calls.map((c) => c[0] as string).find((q) => q.includes(fromMs) && q.includes(toMs));

			expect(query).toBeDefined();
		});

		it('should support bucket size downsampling', async () => {
			storageMock.query.mockResolvedValue([]);

			const response = await authGet(timeseriesUrl())
				.query({
					from: '2025-01-01T00:00:00Z',
					to: '2025-01-02T00:00:00Z',
					bucket: '15m',
				})
				.expect(200);

			expect(response.body.data.bucket).toBe('15m');

			const query = storageMock.query.mock.calls[0][0] as string;

			expect(query).toContain('GROUP BY time(15m)');
		});

		it('should use default time range when from/to are not provided', async () => {
			storageMock.query.mockResolvedValue([]);

			const response = await authGet(timeseriesUrl()).expect(200);

			// Default is last 24 hours, so bucket should be '5m'
			expect(response.body.data.bucket).toBe('5m');
			expect(response.body.data).toHaveProperty('from');
			expect(response.body.data).toHaveProperty('to');
		});

		it('should handle empty data gracefully when InfluxDB returns no results', async () => {
			storageMock.query.mockResolvedValue([]);

			const response = await authGet(timeseriesUrl())
				.query({
					from: '2025-01-01T00:00:00Z',
					to: '2025-01-02T00:00:00Z',
				})
				.expect(200);

			expect(response.body.data.points).toEqual([]);
			expect(response.body.data.property).toBe(propertyId);
		});

		it('should handle InfluxDB errors gracefully and return empty points', async () => {
			storageMock.query.mockRejectedValue(new Error('InfluxDB connection failed'));

			const response = await authGet(timeseriesUrl())
				.query({
					from: '2025-01-01T00:00:00Z',
					to: '2025-01-02T00:00:00Z',
				})
				.expect(200);

			expect(response.body.data.points).toEqual([]);
		});

		it('should return 404 for non-existent channel', async () => {
			await authGet(timeseriesUrl('00000000-0000-4000-a000-000000000000', propertyId)).expect(404);
		});

		it('should return 404 for non-existent property', async () => {
			await authGet(timeseriesUrl(channelId, '00000000-0000-4000-a000-000000000000')).expect(404);
		});

		it('should return 400 for invalid UUID format', async () => {
			await authGet(timeseriesUrl('not-a-uuid', propertyId)).expect(400);
		});

		it('should return 401 for unauthenticated requests', async () => {
			await request(app.getHttpServer()).get(timeseriesUrl()).expect(401);
		});
	});
});
