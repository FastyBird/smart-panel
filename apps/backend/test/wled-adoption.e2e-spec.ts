/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { useContainer } from 'class-validator';
import request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { DeviceCategory } from '../src/modules/devices/devices.constants';
import { DEVICES_WLED_PLUGIN_PREFIX } from '../src/plugins/devices-wled/devices-wled.constants';
import { DevicesWledPlugin } from '../src/plugins/devices-wled/devices-wled.plugin';
import { WledService } from '../src/plugins/devices-wled/services/wled.service';

describe('WLED adoption endpoints (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	const wledService = {
		owner: { kind: 'plugin', type: 'devices-wled-plugin' },
		serviceId: 'connector',
		getState: jest.fn().mockReturnValue('stopped'),
		start: jest.fn().mockResolvedValue(undefined),
		stop: jest.fn().mockResolvedValue(undefined),
		onConfigChanged: jest.fn().mockResolvedValue({ restartRequired: false }),
		getDiscoveryInventory: jest.fn().mockResolvedValue({ mdnsEnabled: true, discoveryRunning: true, devices: [] }),
		rescanDiscovery: jest.fn().mockResolvedValue({ mdnsEnabled: true, discoveryRunning: true, devices: [] }),
		probeDevice: jest.fn().mockResolvedValue({
			host: '192.168.1.100',
			name: 'WLED',
			mac: 'AA:BB:CC:DD:EE:FF',
			port: 80,
			adoptedDeviceId: null,
		}),
		adoptDevices: jest
			.fn()
			.mockResolvedValue([
				{ host: '192.168.1.100', name: 'WLED', status: 'created', error: null, deviceId: 'device-1' },
			]),
	};

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [{ routePrefix: DEVICES_WLED_PLUGIN_PREFIX, extensionClass: DevicesWledPlugin }],
		});
		const moduleFixture = await Test.createTestingModule({ imports: [dynamicAppModule] })
			.overrideProvider(WledService)
			.useValue(wledService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(moduleFixture, { fallbackOnErrors: true });
		await app.init();

		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: { username: 'wledtest', password: 'securePassword123!', email: 'wledtest@example.com' },
			});
		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: { username: 'wledtest', password: 'securePassword123!' },
			});
		accessToken = (login.body as { data: { access_token: string } }).data.access_token;
	});

	afterAll(async () => {
		await app.close();
	});

	it('requires authentication for discovery inventory', async () => {
		await request(app.getHttpServer()).get('/plugins/devices-wled/discovery').expect(401);
	});

	it('returns the authenticated discovery envelope', async () => {
		const response = await request(app.getHttpServer())
			.get('/plugins/devices-wled/discovery')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);

		expect(response.body).toEqual(expect.objectContaining({ data: expect.objectContaining({ mdnsEnabled: true }) }));
	});

	it('validates and executes a manual probe', async () => {
		await request(app.getHttpServer())
			.post('/plugins/devices-wled/discovery/probe')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({})
			.expect(400);

		await request(app.getHttpServer())
			.post('/plugins/devices-wled/discovery/probe')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { host: '192.168.1.100' } })
			.expect(201);
	});

	it('rejects unsupported categories before batch adoption', async () => {
		await request(app.getHttpServer())
			.post('/plugins/devices-wled/discovery/adopt')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { devices: [{ host: '192.168.1.100', name: 'WLED', category: DeviceCategory.SWITCHER }] } })
			.expect(400);

		await request(app.getHttpServer())
			.post('/plugins/devices-wled/discovery/adopt')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ data: { devices: [{ host: '192.168.1.100', name: 'WLED', category: DeviceCategory.LIGHTING }] } })
			.expect(200);
	});
});
