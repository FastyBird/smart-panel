import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	HOMEY_MAPPING_CONTROL_MAPPINGS,
	type HomeyMappingControlBinding,
	type HomeyMappingControlRuntime,
	type HomeyShsMappingControlConfig,
	assertHomeyShsMappingControlReportSafe,
	loadHomeyShsMappingControlConfig,
	probeHomeyShsMappingControl,
	writeHomeyShsMappingControlReport,
} from './support/homey-shs-mapping-control-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_MAPPING_CONTROL_CAPABILITY_ID: 'test-capability-that-must-not-leak',
	FB_HOMEY_SHS_MAPPING_CONTROL_DEVICE_ID: 'test-device-that-must-not-leak',
	FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE:
		'I_WILL_USE_SMART_PANEL_TO_CONTROL_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_MAPPING_TARGET',
	FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY: 'lighting',
	FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME: 'light-power',
	FB_HOMEY_SHS_MAPPING_CONTROL_PANEL_VALUE: 'true',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const config = (overrides: Partial<HomeyShsMappingControlConfig> = {}): HomeyShsMappingControlConfig => ({
	...loadHomeyShsMappingControlConfig(BASE_ENVIRONMENT, '/tmp/homey-mapping-control'),
	...overrides,
});

class FakeBinding implements HomeyMappingControlBinding {
	readonly availableFamilies = ['cover', 'lighting', 'switch'] as const;
	readonly baselinePanelValue = false;
	readonly targetPanelValue = true;
	readonly commands: Array<string | number | boolean> = [];
	current: string | number | boolean = false;
	failCommandAt = new Set<number>();
	failReadBackAt = new Set<number>();
	readBackCount = 0;

	command(value: string | number | boolean): Promise<boolean> {
		this.commands.push(value);
		this.current = value;

		return Promise.resolve(!this.failCommandAt.has(this.commands.length));
	}

	readBackMatches(value: string | number | boolean): Promise<boolean> {
		this.readBackCount += 1;

		return Promise.resolve(this.current === value && !this.failReadBackAt.has(this.readBackCount));
	}
}

class FakeRuntime implements HomeyMappingControlRuntime {
	readonly binding = new FakeBinding();
	bindCount = 0;
	startCount = 0;
	stopCount = 0;

	bind(): Promise<HomeyMappingControlBinding> {
		this.bindCount += 1;

		return Promise.resolve(this.binding);
	}

	start(): Promise<void> {
		this.startCount += 1;

		return Promise.resolve();
	}

	stop(): Promise<void> {
		this.stopCount += 1;

		return Promise.resolve();
	}
}

const successfulProbe = async () => {
	const runtime = new FakeRuntime();
	const report = await probeHomeyShsMappingControl(config(), () => runtime);

	return { report, runtime };
};

describe('Homey SHS mapping-control probe', () => {
	it.each([
		['cover', 'window-covering-position'],
		['cover', 'window-covering-tilt'],
		['lighting', 'light-power'],
		['lighting', 'light-brightness'],
		['lighting', 'light-hue'],
		['lighting', 'light-saturation'],
		['lighting', 'light-color-temperature'],
		['lock', 'lock-on'],
		['switch', 'outlet-power'],
		['switch', 'generic-switch-power'],
	] as const)('accepts the reversible %s mapping %s', (family, mappingName) => {
		expect(
			loadHomeyShsMappingControlConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY: family,
				FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME: mappingName,
			}).mappingName,
		).toBe(mappingName);
		expect(HOMEY_MAPPING_CONTROL_MAPPINGS[family]).toContain(mappingName);
	});

	it('requires the exact gate, family, mapping, target, and panel value while rejecting unrelated gates', () => {
		expect(() =>
			loadHomeyShsMappingControlConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE: 'yes' }),
		).toThrow('required acknowledgement');
		expect(() =>
			loadHomeyShsMappingControlConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY: 'sensor' }),
		).toThrow('must be exactly cover, lighting, lock, or switch');
		expect(() =>
			loadHomeyShsMappingControlConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME: 'outlet-power',
			}),
		).toThrow('not allowed for the selected family');
		expect(() =>
			loadHomeyShsMappingControlConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_MAPPING_CONTROL_DEVICE_ID: ' ' }),
		).toThrow('target and panel value are required');
		expect(() =>
			loadHomeyShsMappingControlConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE: '' }),
		).toThrow('must be unset');
	});

	it('uses the Smart Panel command path once and restores the exact baseline before stopping', async () => {
		const { report, runtime } = await successfulProbe();

		expect(() => assertHomeyShsMappingControlReportSafe(report, config())).not.toThrow();
		expect(report).toMatchObject({
			observation: {
				availableFamilies: ['cover', 'lighting', 'switch'],
				baselineRead: true,
				commandReadBackMatched: true,
				family: 'lighting',
				mappingName: 'light-power',
				panelCommandAccepted: true,
				restorationAccepted: true,
				restorationReadBackMatched: true,
				restored: true,
			},
			session: { cleanupCompleted: true, serviceStarted: true },
		});
		expect(report.session.events).toHaveLength(12);
		expect(runtime.binding.commands).toStrictEqual([true, false]);
		expect(runtime.binding.current).toBe(false);
		expect(runtime.startCount).toBe(1);
		expect(runtime.bindCount).toBe(1);
		expect(runtime.stopCount).toBe(1);
	});

	it('attempts baseline restoration and stops when the requested command is unconfirmed', async () => {
		const runtime = new FakeRuntime();
		runtime.binding.failCommandAt.add(1);

		await expect(probeHomeyShsMappingControl(config(), () => runtime)).rejects.toThrow('rejected or unconfirmed');
		expect(runtime.binding.commands).toStrictEqual([true, false]);
		expect(runtime.binding.current).toBe(false);
		expect(runtime.stopCount).toBe(1);
	});

	it('fails closed when restoration cannot be confirmed and always stops the service', async () => {
		const runtime = new FakeRuntime();
		runtime.binding.failCommandAt.add(2);
		runtime.binding.failCommandAt.add(3);

		await expect(probeHomeyShsMappingControl(config(), () => runtime)).rejects.toThrow(
			'cleanup failed: capability restoration',
		);
		expect(runtime.binding.commands).toStrictEqual([true, false, false]);
		expect(runtime.stopCount).toBe(1);
	});

	it('rejects extra fields, invalid family ordering, reordered evidence, and private values', async () => {
		const { report } = await successfulProbe();

		expect(() => assertHomeyShsMappingControlReportSafe({ ...report, extra: true }, config())).toThrow(
			'root schema is invalid',
		);
		expect(() =>
			assertHomeyShsMappingControlReportSafe(
				{
					...report,
					observation: { ...report.observation, availableFamilies: ['lighting', 'cover', 'switch'] },
				},
				config(),
			),
		).toThrow('available families are invalid');
		expect(() =>
			assertHomeyShsMappingControlReportSafe(
				{ ...report, observation: { ...report.observation, family: 'switch', mappingName: 'outlet-power' } },
				config(),
			),
		).toThrow('target is invalid');
		expect(() =>
			assertHomeyShsMappingControlReportSafe(
				{ ...report, session: { ...report.session, events: [...report.session.events].reverse() } },
				config(),
			),
		).toThrow();
		expect(() =>
			assertHomeyShsMappingControlReportSafe(
				{ ...report, metadata: { ...report.metadata, sdkVersion: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY } },
				config(),
			),
		).toThrow();
	});

	it('writes the report beneath a private non-overwriting directory', async () => {
		const { report } = await successfulProbe();
		const root = await mkdtemp(join(tmpdir(), 'homey-mapping-control-'));

		try {
			const directory = await writeHomeyShsMappingControlReport(report, root);
			const path = join(directory, 'report.json');
			expect((await stat(directory)).mode & 0o777).toBe(0o700);
			expect((await stat(path)).mode & 0o777).toBe(0o600);
			expect(JSON.parse(await readFile(path, 'utf8'))).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
