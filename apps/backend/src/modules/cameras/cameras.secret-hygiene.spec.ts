import { instanceToPlain } from 'class-transformer';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ArgumentsHost, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from '../../../test/support/fake-camera-stream.provider';
import { STUB_GO2RTC_READY_LINE, writeStubGo2rtcScript } from '../../../test/support/stub-go2rtc.script';
import { GlobalErrorFilter } from '../../common/filters/global-error.filter';
import { DeviceCategory } from '../devices/devices.constants';
import { DeviceEntity } from '../devices/entities/devices.entity';
import { DevicesService } from '../devices/services/devices.service';
import { UserRole } from '../users/users.constants';

import { CameraProfileUnavailableException, CamerasForbiddenException } from './cameras.exceptions';
import { CamerasStatusController } from './controllers/cameras-status.controller';
import { CamerasController } from './controllers/cameras.controller';
import { CamerasConfigModel } from './models/config.model';
import { CameraSessionService } from './services/camera-session.service';
import { CameraSnapshotService } from './services/camera-snapshot.service';
import { CameraStreamProviderRegistryService } from './services/camera-stream-provider.registry.service';
import { CamerasService } from './services/cameras.service';
import { Go2rtcProcessService } from './services/go2rtc-process.service';
import { Go2rtcSecretsRegistry } from './services/go2rtc-secrets.registry';
import { Go2rtcStreamsService } from './services/go2rtc-streams.service';
import { Go2rtcRelayStatus, Go2rtcService } from './services/go2rtc.service';

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
	let relayRunning: boolean;
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

		relayRunning = true;
		controller = new CamerasController(service, snapshots, new CameraSessionService(new EventEmitter2()), {
			isRunning: () => relayRunning,
		} as unknown as Go2rtcService);
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

	it.each([
		['profile unavailable', () => new CameraProfileUnavailableException('alias SENTINELALIAS')],
		['forbidden', () => new CamerasForbiddenException('alias SENTINELALIAS')],
	])('never emits the text of a typed %s exception thrown by a provider', async (_name, make) => {
		const thrown = make();

		jest.spyOn(provider, 'listProfiles').mockRejectedValue(thrown);
		jest.spyOn(provider, 'getSnapshot').mockRejectedValue(thrown);

		const res = { header: jest.fn(), send: jest.fn() };
		const errors = [
			await caught(() => service.findAll()),
			await caught(() => controller.findOne(userReq, id)),
			await caught(() => controller.getSnapshot(userReq, id, { profile: 'medium' }, res as never)),
			await caught(() => controller.getSnapshot(userReq, id, {}, res as never)),
			await caught(() => controller.createSession(userReq, id, { data: { transport: 'mse' } } as never)),
		];

		const emitted = JSON.stringify([
			logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]),
			responseSpy.mock.calls,
			await service.findAll(),
			errors.filter((e): e is Error => e !== null).map((e) => [e.name, e.message]),
		]);

		expect(emitted).not.toContain('SENTINELALIAS');
		expect(errors[2]).not.toBeNull();
		expect(errors[4]).not.toBeNull();
	});

	it('never logs the name of an error a provider throws', async () => {
		const thrown = new Error('plain message');

		thrown.name = 'rtsps://fake-console:7441/SENTINELALIAS0123456789?enableSrtp';

		jest.spyOn(provider, 'listProfiles').mockRejectedValue(thrown);
		jest.spyOn(provider, 'getSnapshot').mockRejectedValue(thrown);
		(provider as { getSnapshotMinIntervalMs?: () => number }).getSnapshotMinIntervalMs = () => {
			throw thrown;
		};

		const res = { header: jest.fn(), send: jest.fn() };
		const errors = [
			// The list path: CamerasService.toModel.
			await caught(() => service.findAll()),
			// The provider-call paths: profile lookup for a snapshot and for a session.
			await caught(() => controller.getSnapshot(userReq, id, { profile: 'medium' }, res as never)),
			await caught(() => controller.createSession(userReq, id, { data: { transport: 'mse' } } as never)),
			// The snapshot path: the provider's own getSnapshot and its interval hook.
			await caught(() => controller.getSnapshot(userReq, id, {}, res as never)),
		];

		const logged = JSON.stringify(logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]));

		// The list swallows provider failures, every other path fails.
		expect(errors[0]).toBeNull();
		expect(errors.slice(1).every((e) => e !== null)).toBe(true);
		expect(logged).toContain('ProviderError');
		expect(logged).not.toContain('SENTINELALIAS');
		expect(logged).not.toContain('fake-console:7441');
		expect(JSON.stringify(responseSpy.mock.calls)).not.toContain('SENTINELALIAS');
	});

	it('does not expose a stream url in the camera list', async () => {
		expect(JSON.stringify(instanceToPlain(await service.findAll()))).not.toContain('rtsp');
	});

	describe('relay', () => {
		const PASSWORD = 'PW_SENTINEL_abcdef0123';
		const SENTINELS = /SENTINELALIAS|fake-console:7441|PW_SENTINEL/;
		const unavailable: Go2rtcRelayStatus = {
			mode: 'managed',
			state: 'unavailable',
			reason: 'binary_missing',
			version: null,
			generation: 1,
		};

		let workDir: string;
		let go2rtcProcess: Go2rtcProcessService | null;

		beforeEach(() => {
			workDir = mkdtempSync(join(tmpdir(), 'cameras-hygiene-'));
			go2rtcProcess = null;
		});

		afterEach(async () => {
			await go2rtcProcess?.stop(200).catch(() => undefined);
			rmSync(workDir, { recursive: true, force: true });
		});

		const statusController = (status: Go2rtcRelayStatus): CamerasStatusController =>
			new CamerasStatusController(
				{ getModuleConfig: () => new CamerasConfigModel() } as never,
				{ getStatus: () => status } as unknown as Go2rtcService,
				{ getActiveCount: () => 0 } as never,
			);

		it('keeps the source url and api password out of the status, the ring, logs and errors', async () => {
			const secrets = new Go2rtcSecretsRegistry();

			secrets.add(PASSWORD);

			const putStream = jest.fn().mockRejectedValue(new Error(FAKE_CAMERA_SECRET_URL));
			const go2rtc = {
				getClient: () => ({ authorization: null, putStream, deleteStream: jest.fn(), wsUrl: jest.fn() }),
				getStatus: () => ({ ...unavailable, state: 'running', reason: null, version: '1.9.9' }),
				subscribe: () => () => undefined,
			};
			const streams = new Go2rtcStreamsService(go2rtc as never, service, secrets);

			streams.onModuleInit();

			const caughtErrors: Error[] = [];

			try {
				await streams.acquire(camera, provider, 'medium');
			} catch (error) {
				caughtErrors.push(error as Error);
			}

			go2rtcProcess = new Go2rtcProcessService(secrets);
			go2rtcProcess.start(
				{ binaryPath: writeStubGo2rtcScript(workDir, 'run'), configPath: '/nonexistent/x.yaml', cwd: workDir },
				() => undefined,
			);

			const startedAt = Date.now();

			while (!go2rtcProcess.getOutputLines().includes(STUB_GO2RTC_READY_LINE) && Date.now() - startedAt < 10_000) {
				await new Promise((resolve) => setTimeout(resolve, 20));
			}

			const ringLines = [...go2rtcProcess.getOutputLines()];
			const statusBody = instanceToPlain(statusController(go2rtc.getStatus() as Go2rtcRelayStatus).getStatus(userReq));

			await streams.onModuleDestroy();

			// The scenarios actually ran: a failed registration and a ring that holds the stub's output.
			expect(caughtErrors).toHaveLength(1);
			expect(putStream).toHaveBeenCalledTimes(1);
			expect(ringLines.some((line) => line.startsWith('stub password='))).toBe(true);
			expect(ringLines.some((line) => line.startsWith('stub source='))).toBe(true);
			expect(JSON.stringify(statusBody)).toContain('"version":"1.9.9"');

			const emitted = JSON.stringify([
				logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]),
				statusBody,
				ringLines,
				caughtErrors.map((e) => [e.name, e.message]),
			]);

			expect(emitted).not.toMatch(SENTINELS);
		});

		it('keeps secrets out of the session 503 and the status of an unavailable relay', async () => {
			relayRunning = false;

			const error = await caught(() => controller.createSession(userReq, id, { data: { transport: 'mse' } } as never));
			const statusBody = instanceToPlain(statusController(unavailable).getStatus(userReq));

			expect(error?.message).toBe('Live view relay is not available');
			expect(statusBody).toMatchObject({ data: { relay: { state: 'unavailable', reason: 'binary_missing' } } });
			expect(
				JSON.stringify([
					statusBody,
					responseSpy.mock.calls,
					logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]),
				]),
			).not.toMatch(SENTINELS);
		});

		it('keeps snapshots working while the relay is unavailable', async () => {
			relayRunning = false;

			const res = { header: jest.fn(), send: jest.fn() };

			await controller.getSnapshot(userReq, id, {}, res as never);

			expect(res.send).toHaveBeenCalledTimes(1);
			expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
			expect(res.header).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
			expect(statusController(unavailable).getStatus(userReq).data.relay.state).toBe('unavailable');
		});
	});
});
