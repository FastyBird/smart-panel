import { instanceToPlain } from 'class-transformer';

import { ArgumentsHost, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { FakeCameraStreamProvider } from '../../../test/support/fake-camera-stream.provider';
import { GlobalErrorFilter } from '../../common/filters/global-error.filter';
import { DeviceCategory } from '../devices/devices.constants';
import { DeviceEntity } from '../devices/entities/devices.entity';
import { DevicesService } from '../devices/services/devices.service';
import { UserRole } from '../users/users.constants';

import { CamerasController } from './controllers/cameras.controller';
import { CameraSessionService } from './services/camera-session.service';
import { CameraSnapshotService } from './services/camera-snapshot.service';
import { CameraStreamProviderRegistryService } from './services/camera-stream-provider.registry.service';
import { CamerasService } from './services/cameras.service';

describe('Cameras secret hygiene', () => {
	const id = '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b';
	const camera = {
		id,
		name: 'Cam',
		category: DeviceCategory.CAMERA,
		type: 'devices-fake',
		channels: [],
	} as unknown as DeviceEntity;
	const userReq = { auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never;

	let provider: FakeCameraStreamProvider;
	let service: CamerasService;
	let controller: CamerasController;
	let logSpies: jest.SpyInstance[];
	let responseSpy: jest.Mock;

	beforeEach(() => {
		provider = new FakeCameraStreamProvider('devices-fake');

		const registry = new CameraStreamProviderRegistryService();

		registry.register(provider);

		const devicesService = {
			findAll: jest.fn().mockResolvedValue([camera]),
			findOne: jest.fn().mockResolvedValue(camera),
		};

		service = new CamerasService(devicesService as unknown as DevicesService, registry);

		const snapshots = new CameraSnapshotService(service);

		controller = new CamerasController(service, snapshots, new CameraSessionService(new EventEmitter2()));
		logSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
			jest.spyOn(Logger.prototype, m).mockImplementation(),
		);
		responseSpy = jest.fn();
	});

	afterEach(() => jest.restoreAllMocks());

	const caught = async (fn: () => Promise<unknown>): Promise<Error | null> => {
		try {
			responseSpy(await fn());

			return null;
		} catch (error) {
			// What the global filter would log and return for this error.
			const send = jest.fn();
			const reply = { code: () => ({ type: () => ({ send }) }) };
			const host = {
				switchToHttp: () => ({
					getRequest: () => ({ method: 'GET', originalUrl: '/x' }),
					getResponse: () => reply,
				}),
			} as unknown as ArgumentsHost;

			new GlobalErrorFilter().catch(error, host);

			responseSpy(send.mock.calls);

			return error as Error;
		}
	};

	it('never emits the source URL in logs, responses or errors', async () => {
		provider.mode = 'throw_with_secret';

		const res = { header: jest.fn(), send: jest.fn() };
		const errors = [
			await caught(() => service.findAll()),
			await caught(() => controller.findOne(userReq, id)),
			await caught(() => controller.getSnapshot(userReq, id, { profile: 'medium' }, res as never)),
			await caught(() => controller.getSnapshot(userReq, id, {}, res as never)),
			await caught(() => controller.createSession(userReq, id, { data: { transport: 'mse' } } as never)),
		];

		const models = await service.findAll();
		const emitted = JSON.stringify([
			logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]),
			responseSpy.mock.calls,
			models,
			errors.filter((e): e is Error => e !== null).map((e) => [e.name, e.message]),
		]);

		expect(emitted).not.toContain('SENTINELALIAS');
		expect(emitted).not.toContain('fake-console:7441');
		expect(errors[4]).not.toBeNull();
	});

	it('does not expose a stream url in the camera list', async () => {
		expect(JSON.stringify(instanceToPlain(await service.findAll()))).not.toContain('rtsp');
	});
});
