import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HOMEKIT_PAIRING_STORAGE_DIR } from '../devices-homekit.constants';
import { HomeKitConfigModel } from '../models/config.model';

import { HomeKitBridgeService } from './homekit-bridge.service';
import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

jest.mock('fs', () => {
	const actual = jest.requireActual<typeof import('fs')>('fs');
	return {
		...actual,
		chmodSync: jest.fn((...args: Parameters<typeof actual.chmodSync>) => actual.chmodSync(...args)),
		statSync: jest.fn((...args: Parameters<typeof actual.statSync>) => actual.statSync(...args)),
	};
});

const describePosix = process.platform === 'win32' ? describe.skip : describe;

describePosix('HomeKitBridgeService Storage Permissions', () => {
	let testDir: string;
	let originalConfigPath: string | undefined;

	beforeEach(() => {
		const actual = jest.requireActual<typeof import('fs')>('fs');
		(fs.chmodSync as jest.Mock).mockImplementation((...args: Parameters<typeof actual.chmodSync>) =>
			actual.chmodSync(...args),
		);
		(fs.statSync as jest.Mock).mockImplementation((...args: Parameters<typeof actual.statSync>) =>
			actual.statSync(...args),
		);

		originalConfigPath = process.env.FB_CONFIG_PATH;
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-perm-test-'));
		process.env.FB_CONFIG_PATH = testDir;
	});

	afterEach(() => {
		if (originalConfigPath !== undefined) {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		} else {
			delete process.env.FB_CONFIG_PATH;
		}
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	const createService = () => {
		const config = new HomeKitConfigModel();
		config.enabled = true;
		config.bridgeName = 'Test Bridge';
		config.port = 51826;
		config.pincode = '031-45-154';
		config.username = 'CC:22:3D:E3:CE:30';
		config.setupId = 'SP01';
		config.mappedDeviceIds = [];

		const configService = {
			getPluginConfig: jest.fn().mockReturnValue(config),
			updatePluginConfig: jest.fn().mockResolvedValue(undefined),
		} as unknown as ConfigService;

		const devicesService = {
			findOne: jest.fn().mockResolvedValue(null),
		} as unknown as DevicesService;

		const mapperRegistry = {
			clearAllBindings: jest.fn(),
			clearDeviceBindings: jest.fn(),
			commitStaged: jest.fn(),
			buildAccessory: jest.fn(),
			getSnapshot: jest
				.fn()
				.mockReturnValue({ propertyBindings: new Map(), propertyListeners: new Map(), deviceProperties: new Map() }),
			restoreSnapshot: jest.fn(),
		} as unknown as HomeKitMapperRegistryService;

		const commandDispatcher = {
			dispatch: jest.fn(),
			dispatchBatch: jest.fn(),
		} as unknown as HomeKitCommandDispatcher;

		const eventEmitter = {
			emit: jest.fn(),
		} as unknown as EventEmitter2;

		return new HomeKitBridgeService(configService, devicesService, mapperRegistry, commandDispatcher, eventEmitter);
	};

	it('creates pairing storage directory with 0700 permissions when it does not exist', () => {
		const service = createService();
		const storageDir = path.join(testDir, HOMEKIT_PAIRING_STORAGE_DIR);

		expect(fs.existsSync(storageDir)).toBe(false);

		// Trigger storage initialization
		service['initHapStorage']();

		expect(fs.existsSync(storageDir)).toBe(true);
		const stat = fs.statSync(storageDir);
		expect(stat.mode & 0o777).toBe(0o700);
	});

	it('tightens permissions of an existing 0755 storage directory to 0700', () => {
		const storageDir = path.join(testDir, HOMEKIT_PAIRING_STORAGE_DIR);
		fs.mkdirSync(storageDir, { recursive: true });
		fs.chmodSync(storageDir, 0o755);

		expect(fs.statSync(storageDir).mode & 0o777).toBe(0o755);

		const service = createService();
		service['initHapStorage']();

		expect(fs.statSync(storageDir).mode & 0o777).toBe(0o700);
	});

	it('tightens permissions of existing pairing files in storage directory to 0600', () => {
		const storageDir = path.join(testDir, HOMEKIT_PAIRING_STORAGE_DIR);
		fs.mkdirSync(storageDir, { recursive: true });
		fs.chmodSync(storageDir, 0o755);

		const pairingFile = path.join(storageDir, 'accessoryInfo.CC223DE3CE30.json');
		fs.writeFileSync(pairingFile, '{"pincode":"031-45-154"}', { mode: 0o644 });
		fs.chmodSync(pairingFile, 0o644);

		expect(fs.statSync(pairingFile).mode & 0o777).toBe(0o644);

		const service = createService();
		service['initHapStorage']();

		expect(fs.statSync(storageDir).mode & 0o777).toBe(0o700);
		expect(fs.statSync(pairingFile).mode & 0o777).toBe(0o600);
	});

	it('fails closed and throws if chmodSync rejects when securing storage directory', () => {
		const storageDir = path.join(testDir, HOMEKIT_PAIRING_STORAGE_DIR);
		fs.mkdirSync(storageDir, { recursive: true });
		fs.chmodSync(storageDir, 0o755);

		const actual = jest.requireActual<typeof import('fs')>('fs');
		(fs.chmodSync as jest.Mock).mockImplementationOnce((targetPath: string, mode: number) => {
			if (typeof targetPath === 'string' && targetPath.includes(HOMEKIT_PAIRING_STORAGE_DIR)) {
				const err = new Error('EPERM: operation not permitted, chmod');
				(err as NodeJS.ErrnoException).code = 'EPERM';
				throw err;
			}
			return actual.chmodSync(targetPath, mode);
		});

		const service = createService();
		expect(() => service['initHapStorage']()).toThrow(/EPERM/);
	});

	it('fails closed and throws if storage directory permissions cannot be verified as 0700', () => {
		const storageDir = path.join(testDir, HOMEKIT_PAIRING_STORAGE_DIR);
		fs.mkdirSync(storageDir, { recursive: true });

		(fs.statSync as jest.Mock).mockReturnValue({
			mode: 0o777,
			isFile: () => false,
		} as fs.Stats);

		const service = createService();
		expect(() => service['initHapStorage']()).toThrow(/permissions could not be verified as 0700/);
	});
});
