import { FastifyRequest } from 'fastify';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { ConfigService } from '../config/services/config.service';
import { UserRole } from '../users/users.constants';

import { CAMERAS_MODULE_NAME } from './cameras.constants';
import { CamerasStatusController } from './controllers/cameras-status.controller';
import { CamerasController } from './controllers/cameras.controller';
import { LiveStreamGateway } from './gateway/live-stream.gateway';
import { CamerasConfigModel } from './models/config.model';
import { CameraSessionService } from './services/camera-session.service';
import { CameraSnapshotService } from './services/camera-snapshot.service';
import { CamerasService } from './services/cameras.service';
import { Go2rtcService } from './services/go2rtc.service';

@Injectable()
class FakeAuthGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		context.switchToHttp().getRequest<FastifyRequest & { auth: unknown }>().auth = {
			type: 'user',
			id: 'u1',
			role: UserRole.USER,
		};

		return true;
	}
}

describe('Cameras module toggle (routes)', () => {
	const id = '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b';
	const data = Buffer.from([0xff, 0xd8, 1]);

	let app: NestFastifyApplication;
	let enabled: boolean;
	let cameras: { findAll: jest.Mock; getOneOrThrow: jest.Mock; toModel: jest.Mock; getProviderOrThrow: jest.Mock };
	let snapshots: { getSnapshot: jest.Mock };
	let sessions: { beginCreate: jest.Mock; endCreate: jest.Mock; create: jest.Mock };

	beforeAll(async () => {
		cameras = {
			findAll: jest.fn().mockResolvedValue([]),
			getOneOrThrow: jest.fn().mockResolvedValue({ device: { id }, provider: null }),
			toModel: jest.fn().mockResolvedValue({ deviceId: id }),
			getProviderOrThrow: jest.fn().mockResolvedValue({ device: { id }, provider: {} }),
		};
		snapshots = {
			getSnapshot: jest.fn().mockResolvedValue({ contentType: 'image/jpeg', data, ageMs: 0, stale: false }),
		};
		sessions = {
			beginCreate: jest.fn().mockReturnValue({}),
			endCreate: jest.fn(),
			create: jest.fn().mockReturnValue({ session: { id: 'sid', expiresAt: Date.now() + 60_000 }, token: 'tok' }),
		};
		(cameras as Record<string, jest.Mock>).resolveProfile = jest.fn().mockResolvedValue({ id: 'medium' });

		const moduleRef = await Test.createTestingModule({
			controllers: [CamerasController, CamerasStatusController],
			providers: [
				{ provide: CamerasService, useValue: cameras },
				{ provide: CameraSnapshotService, useValue: snapshots },
				{ provide: CameraSessionService, useValue: sessions },
				{
					provide: Go2rtcService,
					useValue: {
						isRunning: () => true,
						getStatus: () => ({ mode: 'managed', state: 'running', reason: null, version: '1.9.9', generation: 1 }),
					},
				},
				{ provide: LiveStreamGateway, useValue: { getActiveCount: () => 0 } },
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: (type: string) => {
							expect(type).toBe(CAMERAS_MODULE_NAME);

							return Object.assign(new CamerasConfigModel(), { enabled });
						},
					},
				},
				{ provide: APP_GUARD, useClass: FakeAuthGuard },
			],
		}).compile();

		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(() => app.close());

	beforeEach(() => {
		jest.clearAllMocks();
		enabled = true;
	});

	const routes = [
		['list', 'GET', '/cameras', undefined],
		['detail', 'GET', `/cameras/${id}`, undefined],
		['snapshot', 'GET', `/cameras/${id}/snapshot`, undefined],
		['status', 'GET', '/status', undefined],
		['session', 'POST', `/cameras/${id}/sessions`, { data: { transport: 'mse' } }],
	] as const;

	describe.each(routes)('%s', (_name, method, url, payload) => {
		it('answers normally while the module is enabled', async () => {
			const response = await app.inject({ method, url, payload: payload as Record<string, unknown> | undefined });

			expect(response.statusCode).toBe(method === 'POST' ? 201 : 200);
		});

		it('answers 404 Cameras module is disabled and never reaches the services when the module is off', async () => {
			enabled = false;

			const response = await app.inject({ method, url, payload: payload as Record<string, unknown> | undefined });

			expect(response.statusCode).toBe(404);
			expect(response.body).toContain('Cameras module is disabled');
			expect(cameras.findAll).not.toHaveBeenCalled();
			expect(cameras.getOneOrThrow).not.toHaveBeenCalled();
			expect(cameras.getProviderOrThrow).not.toHaveBeenCalled();
			expect(snapshots.getSnapshot).not.toHaveBeenCalled();
			expect(sessions.create).not.toHaveBeenCalled();
		});
	});
});
