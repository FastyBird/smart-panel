import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';

import { TailscaleCliService } from './tailscale-cli.service';
import { TailscaleNodeManagedService } from './tailscale-node-managed.service';
import { TailscaleServeService } from './tailscale-serve.service';
import { TailscaleStatusMapperService } from './tailscale-status-mapper.service';

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

interface CapturedCommand {
	args: string[];
	phase: 'baseline' | 'operator-change';
	stdout: string;
	stderr: string;
	exitCode: number;
}

interface CliCapture {
	version: string;
	commands: CapturedCommand[];
}

type ExecCallback = (error: (Error & { code?: number }) | null, stdout: string, stderr: string) => void;

// Only the process boundary is replayed. Outputs and exit codes come from the
// pinned, network-isolated CLI/daemon captures, not hand-written JSON shapes.
describe.each(['1.66.0', '1.102.5'])('Tailscale %s captured CLI compatibility', (version) => {
	const capture = JSON.parse(
		readFileSync(join(__dirname, 'fixtures', 'tailscale-cli', `${version}.json`), 'utf8'),
	) as CliCapture;
	let cli: TailscaleCliService;
	let module: TestingModule;
	let preferencesPhase: CapturedCommand['phase'];

	const command = (args: string[], phase: CapturedCommand['phase'] = 'baseline'): CapturedCommand => {
		const result = capture.commands.find(
			(candidate) => candidate.phase === phase && candidate.args.join('\0') === args.join('\0'),
		);

		if (!result) {
			throw new Error(`Missing ${version} ${phase} capture for ${args.join(' ')}`);
		}

		return result;
	};

	beforeEach(async () => {
		preferencesPhase = 'baseline';
		jest
			.mocked(execFile)
			.mockImplementation((file: string, args: string[], _options: unknown, callback: ExecCallback) => {
				// Platform/systemd detection is supplied separately: the capture
				// container is not evidence of a supported production platform.
				if (file === 'systemctl' && args.join(' ') === 'is-active tailscaled') {
					callback(null, 'active\n', '');
					return {} as ReturnType<typeof execFile>;
				}

				if (file !== 'tailscale') {
					throw new Error(`Unexpected compatibility probe: ${file}`);
				}

				const result = command(args, args.join(' ') === 'debug prefs' ? preferencesPhase : 'baseline');
				const error =
					result.exitCode === 0 ? null : Object.assign(new Error('Captured CLI failure'), { code: result.exitCode });
				callback(error, result.stdout, result.stderr);

				return {} as ReturnType<typeof execFile>;
			});

		const config = new RemoteAccessTailscalePluginConfigModel();
		config.enabled = true;
		module = await Test.createTestingModule({
			providers: [
				TailscaleCliService,
				TailscaleStatusMapperService,
				TailscaleNodeManagedService,
				{ provide: ConfigService, useValue: { getPluginConfig: jest.fn().mockReturnValue(config) } },
				{ provide: NestConfigService, useValue: { get: jest.fn() } },
				{
					provide: PlatformService,
					useValue: { getPlatformTypeAsync: jest.fn().mockResolvedValue(PlatformType.GENERIC) },
				},
				{ provide: EventEmitter2, useValue: { emit: jest.fn() } },
				{ provide: TailscaleServeService, useValue: {} },
			],
		}).compile();
		cli = module.get(TailscaleCliService);
	});

	afterEach(async () => {
		await module.close();
		jest.resetAllMocks();
	});

	it('reads the pinned release version from its genuine JSON output', async () => {
		expect(capture.version).toBe(version);
		await expect(cli.getVersion()).resolves.toMatchObject({ version });
	});

	it('recognizes unauthenticated status without mistaking successful CLI execution for authentication', async () => {
		// Both captured releases return 0 for this NeedsLogin state. The
		// synthetic nonzero-JSON regression remains in the existing CLI spec.
		expect(command(['status', '--json']).exitCode).toBe(0);
		const status = await cli.getStatus();
		expect(status.BackendState).toBe('NeedsLogin');
		expect(module.get(TailscaleStatusMapperService).hasExistingKey(status)).toBe(false);
	});

	it('accepts real preferences that omit the unassigned operator', async () => {
		const preferences = await cli.getPrefs();
		expect(preferences.OperatorUser).toBeUndefined();
		expect(preferences.WantRunning).toBe(false);
	});

	it('reads the operator configured by root in the isolated daemon', async () => {
		// This checks read-back parsing, not the service user's write access.
		preferencesPhase = 'operator-change';
		await expect(cli.getPrefs()).resolves.toMatchObject({ OperatorUser: 'nobody' });
	});

	it('reads the genuine empty Serve configuration', async () => {
		await expect(cli.serveStatus()).resolves.toEqual({});
	});

	it('supports the captured version while retaining the missing-operator remedy', async () => {
		const requirements = await module.get(TailscaleNodeManagedService).evaluateRequirements();
		expect(requirements.find(({ code }) => code === 'version-supported')).toMatchObject({ satisfied: true });
		expect(requirements.find(({ code }) => code === 'binary-installed')).toMatchObject({ satisfied: true });
		expect(requirements.find(({ code }) => code === 'operator-granted')).toMatchObject({
			satisfied: false,
			remedy: { commands: [expect.stringMatching(/^sudo tailscale set --operator=/)] },
		});
		expect(
			jest
				.mocked(execFile)
				.mock.calls.filter(([file]) => file === 'tailscale')
				.map(([, args]) => args),
		).toEqual(
			expect.arrayContaining([
				['version', '--json'],
				['debug', 'prefs'],
			]),
		);
		expect(jest.mocked(execFile).mock.calls.filter(([file]) => file === 'tailscale')).toHaveLength(2);
	});
});
