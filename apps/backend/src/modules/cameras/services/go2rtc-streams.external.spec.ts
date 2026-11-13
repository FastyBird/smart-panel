import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from '../../../../test/support/fake-camera-stream.provider';
import { StubGo2rtcServer } from '../../../../test/support/stub-go2rtc.server';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CamerasConfigModel, CamerasGo2rtcConfigModel } from '../models/config.model';

import { CamerasService } from './cameras.service';
import { Go2rtcProcessService } from './go2rtc-process.service';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';
import { Go2rtcStreamsService } from './go2rtc-streams.service';
import { Go2rtcService } from './go2rtc.service';

const SENT_URL = FAKE_CAMERA_SECRET_URL.replace(/^rtsps/, 'rtspx');

async function waitFor(check: () => boolean | Promise<boolean>, what: string, timeoutMs = 5000): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (await check()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 20));
	}

	throw new Error(`Timed out waiting for ${what}`);
}

/**
 * The real `Go2rtcService` against a stub external go2rtc: `Go2rtcService.teardown` clears its client before it
 * publishes the new status, so these cases prove the streams are still deleted from the external relay.
 */
describe('Go2rtcStreamsService with a real Go2rtcService and an external go2rtc', () => {
	const camera = { id: 'cam-1', category: 'camera', type: 'devices-fake' } as unknown as DeviceEntity;

	let workDir: string;
	let stub: StubGo2rtcServer;
	let stubUrl: string;
	let config: CamerasConfigModel;
	let secrets: Go2rtcSecretsRegistry;
	let relay: Go2rtcService;
	let streams: Go2rtcStreamsService;
	let provider: FakeCameraStreamProvider;
	let name: string;

	const streamNames = async (): Promise<string[]> => {
		const response = await fetch(`${stubUrl}/api/streams`);

		return Object.keys((await response.json()) as Record<string, unknown>);
	};

	beforeEach(async () => {
		(['log', 'warn', 'error', 'debug', 'verbose'] as const).forEach((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined),
		);

		workDir = mkdtempSync(join(tmpdir(), 'go2rtc-streams-external-'));
		stub = new StubGo2rtcServer();
		stubUrl = await stub.start();

		config = Object.assign(new CamerasConfigModel(), {
			go2rtc: Object.assign(new CamerasGo2rtcConfigModel(), { mode: 'external', externalUrl: stubUrl }),
		});
		secrets = new Go2rtcSecretsRegistry();
		provider = new FakeCameraStreamProvider('devices-fake');

		relay = new Go2rtcService(
			{ getModuleConfig: jest.fn(() => config) } as never,
			{ get: jest.fn((key: string) => (key === 'FB_CONFIG_PATH' ? workDir : undefined)) } as never,
			{
				isRunning: () => false,
				start: jest.fn(),
				stop: jest.fn().mockResolvedValue(undefined),
				getOutputLines: () => [],
			} as unknown as Go2rtcProcessService,
			secrets,
		);

		streams = new Go2rtcStreamsService(
			relay,
			new CamerasService({ findAll: jest.fn(), findOne: jest.fn() } as never, { get: jest.fn() } as never),
			secrets,
		);

		await relay.start();
		streams.onModuleInit();

		expect(relay.getStatus()).toMatchObject({ mode: 'external', state: 'running' });

		await streams.acquire(camera, provider, 'medium');

		name = `smart-panel_${relay.getInstallationId()}_${camera.id}_medium`;

		expect(stub.puts).toEqual([{ name, src: SENT_URL }]);
		expect(await streamNames()).toEqual([name]);
	});

	afterEach(async () => {
		await streams.onModuleDestroy();
		await relay.stop().catch(() => undefined);
		await stub.stop();

		jest.restoreAllMocks();
		rmSync(workDir, { recursive: true, force: true });
	});

	it('names the stream with the persisted installation id', () => {
		expect(name).toMatch(/^smart-panel_[a-z0-9]{8}_cam-1_medium$/);
		expect(readFileSync(join(workDir, 'go2rtc', 'installation-id'), 'utf8').trim()).toBe(relay.getInstallationId());
	});

	it('deletes the streams from the external relay on stop()', async () => {
		await relay.stop();

		expect(relay.getClient()).toBeNull();

		await waitFor(() => stub.deletes.includes(name), 'the DELETE after stop()');
		await waitFor(() => secrets.list().length === 0, 'the secrets to be released');

		expect(await streamNames()).toEqual([]);
	});

	it('deletes the streams when the mode switches from external to managed', async () => {
		config.go2rtc.mode = 'managed';
		// A relative binary path keeps the managed relay from spawning anything.
		config.go2rtc.binaryPath = 'go2rtc';

		await relay.stop();
		await relay.start();

		expect(relay.getStatus()).toMatchObject({ mode: 'managed', state: 'unavailable', reason: 'binary_path_invalid' });

		await waitFor(() => stub.deletes.includes(name), 'the DELETE after the mode switch');

		expect(await streamNames()).toEqual([]);
		expect(secrets.list()).toEqual([]);
	});

	it('deletes the streams when the mode switches from external to disabled', async () => {
		config.go2rtc.mode = 'disabled';

		await relay.stop();
		await relay.start();

		expect(relay.getStatus()).toMatchObject({ mode: 'disabled', state: 'disabled' });

		await waitFor(() => stub.deletes.includes(name), 'the DELETE after the mode switch');

		expect(await streamNames()).toEqual([]);
	});

	it('deletes the streams when the module is destroyed', async () => {
		await relay.onModuleDestroy();
		await streams.onModuleDestroy();

		expect(stub.deletes).toContain(name);
		expect(await streamNames()).toEqual([]);
		expect(secrets.list()).toEqual([]);
	});

	it('keeps the source redactable while the external relay cannot be reached, and releases it on module destroy', async () => {
		await stub.stop();

		await relay.stop();
		await new Promise((resolve) => setTimeout(resolve, 100));

		// The DELETE could not be sent: the stream still exists on the external relay, and so must the secret.
		expect(secrets.list()).toContain(SENT_URL);
		expect(existsSync(join(workDir, 'go2rtc', 'installation-id'))).toBe(true);

		await streams.onModuleDestroy();

		expect(secrets.list()).toEqual([]);
	});
});
