import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConfigService } from '../../src/modules/config/services/config.service';
import { ChannelCategory, PermissionType } from '../../src/modules/devices/devices.constants';
import { PropertyCommandValue } from '../../src/modules/devices/utils/property-command-value.utils';
import { validatePropertyCommandValue } from '../../src/modules/devices/utils/property-command-value.utils';
import { HomeyLocalConnectorFactory } from '../../src/plugins/devices-homey/connectors/homey-local-connector.factory';
import { HomeySdkClientFactoryService } from '../../src/plugins/devices-homey/connectors/homey-sdk.client';
import {
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
} from '../../src/plugins/devices-homey/devices-homey.constants';
import {
	HomeyChannelEntity,
	HomeyChannelPropertyEntity,
	HomeyDeviceEntity,
} from '../../src/plugins/devices-homey/entities/devices-homey.entity';
import { HomeyMappingLoaderService } from '../../src/plugins/devices-homey/mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../../src/plugins/devices-homey/mappings/mapping-transformer.service';
import { ResolvedHomeyPropertyMapping } from '../../src/plugins/devices-homey/mappings/mapping.types';
import { HomeyConfigModel } from '../../src/plugins/devices-homey/models/config.model';
import { HomeyCapability } from '../../src/plugins/devices-homey/models/homey-capability.model';
import { HomeyDevice } from '../../src/plugins/devices-homey/models/homey-device.model';
import { homeyCapabilityValuesEqual } from '../../src/plugins/devices-homey/platforms/homey-command-value';
import {
	HomeyDevicePlatform,
	HomeyDevicePropertyData,
} from '../../src/plugins/devices-homey/platforms/homey-device.platform';
import {
	type HomeyOperationalDiagnostics,
	HomeySynchronizerService,
} from '../../src/plugins/devices-homey/services/homey-synchronizer.service';
import { HomeyService } from '../../src/plugins/devices-homey/services/homey.service';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const ENABLE_ACKNOWLEDGEMENT =
	'I_WILL_USE_SMART_PANEL_TO_CONTROL_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_MAPPING_TARGET';
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const CONFLICTING_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_ORIGIN_EVENT_',
	'FB_HOMEY_SHS_REALTIME_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_RESTART_EVENT_FLOW_',
	'FB_HOMEY_SHS_STARTUP_',
	'FB_HOMEY_SHS_WRITE_',
] as const;

export const HOMEY_MAPPING_CONTROL_FAMILIES = ['cover', 'lighting', 'lock', 'switch'] as const;
export type HomeyMappingControlFamily = (typeof HOMEY_MAPPING_CONTROL_FAMILIES)[number];

export const HOMEY_MAPPING_CONTROL_MAPPINGS: Readonly<Record<HomeyMappingControlFamily, readonly string[]>> = {
	cover: ['window-covering-position', 'window-covering-tilt'],
	lighting: ['light-power', 'light-brightness', 'light-hue', 'light-saturation', 'light-color-temperature'],
	lock: ['lock-on'],
	switch: ['outlet-power', 'generic-switch-power'],
};

type MappingControlEvent =
	| 'baseline.read.verified'
	| 'command.readback.verified'
	| 'inventory.verified'
	| 'panel.command.requested'
	| 'panel.command.resolved'
	| 'restoration.readback.verified'
	| 'restoration.requested'
	| 'restoration.resolved'
	| 'service.start.requested'
	| 'service.start.resolved'
	| 'service.stop.resolved'
	| 'target.bound';

const SAFE_EVENTS: ReadonlySet<MappingControlEvent> = new Set([
	'baseline.read.verified',
	'command.readback.verified',
	'inventory.verified',
	'panel.command.requested',
	'panel.command.resolved',
	'restoration.readback.verified',
	'restoration.requested',
	'restoration.resolved',
	'service.start.requested',
	'service.start.resolved',
	'service.stop.resolved',
	'target.bound',
]);

export interface HomeyShsMappingControlConfig extends HomeyShsProbeConfig {
	family: HomeyMappingControlFamily;
	mappingName: string;
	panelValue: string;
	target: {
		deviceId: string;
		capabilityId: string;
	};
}

export interface HomeyShsMappingControlReport {
	metadata: {
		probe: 'homey-shs-mapping-control';
		schemaVersion: 1;
		sdkVersion: string;
	};
	observation: {
		availableFamilies: HomeyMappingControlFamily[];
		baselineRead: boolean;
		commandReadBackMatched: boolean;
		family: HomeyMappingControlFamily;
		mappingName: string;
		panelCommandAccepted: boolean;
		restorationAccepted: boolean;
		restorationReadBackMatched: boolean;
		restored: boolean;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: MappingControlEvent; order: number }>;
		serviceStarted: boolean;
	};
}

export interface HomeyMappingControlBinding {
	readonly availableFamilies: readonly HomeyMappingControlFamily[];
	readonly baselinePanelValue: PropertyCommandValue;
	readonly targetPanelValue: PropertyCommandValue;
	command(value: PropertyCommandValue): Promise<boolean>;
	readBackMatches(value: PropertyCommandValue): Promise<boolean>;
}

export interface HomeyMappingControlRuntime {
	bind(config: HomeyShsMappingControlConfig): Promise<HomeyMappingControlBinding>;
	start(): Promise<void>;
	stop(): Promise<void>;
}

export type HomeyMappingControlRuntimeFactory = (config: HomeyShsMappingControlConfig) => HomeyMappingControlRuntime;

const EMPTY_DIAGNOSTICS: HomeyOperationalDiagnostics = {
	adopted: 0,
	adoptedDevices: [],
	missing: 0,
	unsupported: 0,
	unavailable: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isPropertyCommandValue = (value: unknown): value is PropertyCommandValue =>
	typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

const familyForMapping = (mappingName: string): HomeyMappingControlFamily | null =>
	HOMEY_MAPPING_CONTROL_FAMILIES.find((family) => HOMEY_MAPPING_CONTROL_MAPPINGS[family].includes(mappingName)) ?? null;

const isReversibleWritableBinding = (
	device: HomeyDevice,
	capability: HomeyCapability,
	mapping: ResolvedHomeyPropertyMapping,
): boolean =>
	device.available &&
	capability.available !== false &&
	capability.readable &&
	capability.writable &&
	capability.value !== null &&
	mapping.property.direction === 'bidirectional' &&
	familyForMapping(mapping.name) !== null;

const availableFamiliesFor = (
	inventory: readonly HomeyDevice[],
	mappingLoader: HomeyMappingLoaderService,
): HomeyMappingControlFamily[] => {
	const available = new Set<HomeyMappingControlFamily>();

	for (const device of inventory) {
		const capabilities = new Map(device.capabilities.map((capability) => [capability.id, capability]));

		for (const binding of mappingLoader.resolvePropertyMappings(device).mappings) {
			const family = familyForMapping(binding.mapping.name);
			const capability = capabilities.get(binding.capabilityId);

			if (
				family !== null &&
				capability !== undefined &&
				isReversibleWritableBinding(device, capability, binding.mapping)
			) {
				available.add(family);
			}
		}
	}

	return HOMEY_MAPPING_CONTROL_FAMILIES.filter((family) => available.has(family));
};

const createProbeProperty = (
	config: HomeyShsMappingControlConfig,
	mapping: ResolvedHomeyPropertyMapping,
): HomeyDevicePropertyData => {
	const device = Object.assign(new HomeyDeviceEntity(), {
		enabled: true,
		id: 'homey-mapping-control-probe-device',
		identifier: config.target.deviceId,
		name: 'Homey mapping control probe device',
	});
	const channel = Object.assign(new HomeyChannelEntity(), {
		category: ChannelCategory.GENERIC,
		device,
		id: 'homey-mapping-control-probe-channel',
		identifier: mapping.property.channel,
		name: 'Homey mapping control probe channel',
	});
	const range = mapping.property.range;
	const format =
		range !== undefined && (range.minimum !== undefined || range.maximum !== undefined)
			? ([range.minimum ?? null, range.maximum ?? null] as unknown as number[])
			: null;
	const property = Object.assign(new HomeyChannelPropertyEntity(), {
		category: mapping.property.category,
		channel,
		dataType: mapping.property.dataType,
		format,
		homeyCapabilityId: config.target.capabilityId,
		homeyMappingName: mapping.name,
		id: 'homey-mapping-control-probe-property',
		identifier: config.target.capabilityId,
		invalid: null,
		name: 'Homey mapping control probe property',
		permissions: [PermissionType.READ_WRITE],
		step: range?.step ?? null,
	});

	return { channel, device, property, value: false };
};

const createSynchronizer = (): HomeySynchronizerService =>
	({
		filterEvents: (events: readonly unknown[]): readonly unknown[] => [...events],
		getOperationalDiagnostics: (): Promise<HomeyOperationalDiagnostics> => Promise.resolve(EMPTY_DIAGNOSTICS),
		hasReadableCapabilityBinding: (): Promise<boolean> => Promise.resolve(true),
		invalidateIndex: (): void => undefined,
		reset: (): void => undefined,
		synchronizeDevices: (_devices: readonly unknown[], _missing: readonly string[], events: readonly unknown[]) =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
		synchronizeEvents: (events: readonly unknown[]) =>
			Promise.resolve({ acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
		synchronizeSnapshot: (_devices: readonly unknown[], events: readonly unknown[] = []) =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
	}) as unknown as HomeySynchronizerService;

export const createHomeyMappingControlRuntime: HomeyMappingControlRuntimeFactory = (config) => {
	const pluginConfig = Object.assign(new HomeyConfigModel(), {
		apiKey: config.apiKey,
		connectionTimeout: config.timeoutMs,
		enabled: true,
		reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		url: config.origin.origin,
	});
	const configService = {
		getPluginConfig: (pluginName: string): HomeyConfigModel => {
			if (pluginName !== DEVICES_HOMEY_PLUGIN_NAME) {
				throw new Error('Homey mapping-control probe requested an unexpected plugin configuration');
			}

			return pluginConfig;
		},
	};
	const mappingLoader = new HomeyMappingLoaderService();
	mappingLoader.loadAllMappings();
	const transformer = new HomeyMappingTransformerService();
	const service = new HomeyService(
		configService as unknown as ConfigService,
		createSynchronizer(),
		new HomeyLocalConnectorFactory(new HomeySdkClientFactoryService()),
	);
	const platform = new HomeyDevicePlatform(service, mappingLoader, transformer);

	return {
		start: () => service.start(),
		stop: () => service.stop(),
		bind: async (runtimeConfig): Promise<HomeyMappingControlBinding> => {
			const inventory = service.getInventorySnapshot();

			if (inventory === null) throw new Error('Homey mapping-control inventory is unavailable');
			const availableFamilies = availableFamiliesFor(inventory, mappingLoader);

			if (!availableFamilies.includes(runtimeConfig.family)) {
				throw new Error('The requested Homey mapping-control family is not available in the live inventory');
			}
			const device = inventory.find((candidate) => candidate.id === runtimeConfig.target.deviceId);
			const capability = device?.capabilities.find((candidate) => candidate.id === runtimeConfig.target.capabilityId);
			const binding =
				device === undefined
					? undefined
					: mappingLoader
							.resolvePropertyMappings(device)
							.mappings.find(
								(candidate) =>
									candidate.capabilityId === runtimeConfig.target.capabilityId &&
									candidate.mapping.name === runtimeConfig.mappingName,
							);

			if (
				device === undefined ||
				capability === undefined ||
				binding === undefined ||
				!isReversibleWritableBinding(device, capability, binding.mapping)
			) {
				throw new Error('The exact reversible Homey mapping-control target was not found');
			}
			const freshDevice = await service.getFreshDevice(device.id);
			const freshCapability = freshDevice?.capabilities.find((candidate) => candidate.id === capability.id);

			if (
				freshDevice === null ||
				freshCapability === undefined ||
				!isReversibleWritableBinding(freshDevice, freshCapability, binding.mapping)
			) {
				throw new Error('The Homey mapping-control target failed fresh ownership and capability validation');
			}
			const baselineHomeyValue = freshCapability.value;
			const baselinePanelValue = transformer.read(binding.mapping, baselineHomeyValue);
			const commandTarget = createProbeProperty(runtimeConfig, binding.mapping);
			const baselineValidation = validatePropertyCommandValue(commandTarget.property, baselinePanelValue);
			const targetValidation = validatePropertyCommandValue(commandTarget.property, runtimeConfig.panelValue);

			if (
				!baselineValidation.valid ||
				!isPropertyCommandValue(baselineValidation.value) ||
				!targetValidation.valid ||
				!isPropertyCommandValue(targetValidation.value)
			) {
				throw new Error('The Homey mapping-control baseline or requested panel value is invalid');
			}
			if (
				!homeyCapabilityValuesEqual(transformer.write(binding.mapping, baselineValidation.value), baselineHomeyValue)
			) {
				throw new Error('The Homey mapping-control baseline is not exactly reversible through the selected mapping');
			}
			if (homeyCapabilityValuesEqual(transformer.write(binding.mapping, targetValidation.value), baselineHomeyValue)) {
				throw new Error('The Homey mapping-control panel value must change the authoritative capability value');
			}

			const command = (value: PropertyCommandValue): Promise<boolean> => platform.process({ ...commandTarget, value });
			const readBackMatches = async (value: PropertyCommandValue): Promise<boolean> => {
				const expected = transformer.write(binding.mapping, value);
				const readBack = await service.getFreshDevice(device.id);
				const readBackCapability = readBack?.capabilities.find((candidate) => candidate.id === capability.id);

				return readBackCapability !== undefined && homeyCapabilityValuesEqual(readBackCapability.value, expected);
			};

			return {
				availableFamilies,
				baselinePanelValue: baselineValidation.value,
				command,
				readBackMatches,
				targetPanelValue: targetValidation.value,
			};
		},
	};
};

export const loadHomeyShsMappingControlConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsMappingControlConfig => {
	if (environment.FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE !== ENABLE_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE does not contain the required acknowledgement');
	}
	if (Object.keys(environment).some((name) => CONFLICTING_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
		throw new Error('Unrelated Homey mutation and recovery probe gates must be unset during the mapping-control probe');
	}
	const family = environment.FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY?.trim() as HomeyMappingControlFamily | undefined;

	if (family === undefined || !HOMEY_MAPPING_CONTROL_FAMILIES.includes(family)) {
		throw new Error('FB_HOMEY_SHS_MAPPING_CONTROL_FAMILY must be exactly cover, lighting, lock, or switch');
	}
	const mappingName = environment.FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME?.trim() ?? '';

	if (!HOMEY_MAPPING_CONTROL_MAPPINGS[family].includes(mappingName)) {
		throw new Error('FB_HOMEY_SHS_MAPPING_CONTROL_MAPPING_NAME is not allowed for the selected family');
	}
	const deviceId = environment.FB_HOMEY_SHS_MAPPING_CONTROL_DEVICE_ID?.trim() ?? '';
	const capabilityId = environment.FB_HOMEY_SHS_MAPPING_CONTROL_CAPABILITY_ID?.trim() ?? '';
	const panelValue = environment.FB_HOMEY_SHS_MAPPING_CONTROL_PANEL_VALUE?.trim() ?? '';

	if (deviceId.length === 0 || capabilityId.length === 0 || panelValue.length === 0) {
		throw new Error('The exact Homey mapping-control target and panel value are required');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		family,
		mappingName,
		panelValue,
		target: { capabilityId, deviceId },
	};
};

export const probeHomeyShsMappingControl = async (
	config: HomeyShsMappingControlConfig,
	runtimeFactory: HomeyMappingControlRuntimeFactory = createHomeyMappingControlRuntime,
): Promise<HomeyShsMappingControlReport> => {
	const runtime = runtimeFactory(config);
	const events: Array<{ event: MappingControlEvent; order: number }> = [];
	const record = (event: MappingControlEvent): void => {
		events.push({ event, order: events.length + 1 });
	};
	let binding: HomeyMappingControlBinding | undefined;
	let commandAttempted = false;
	let restored = false;
	let operationError: unknown;
	const cleanupFailures: string[] = [];

	try {
		record('service.start.requested');
		await runtime.start();
		record('service.start.resolved');
		binding = await runtime.bind(config);
		record('inventory.verified');
		record('target.bound');
		record('baseline.read.verified');
		record('panel.command.requested');
		commandAttempted = true;
		if (!(await binding.command(binding.targetPanelValue))) {
			throw new Error('Homey mapping-control Smart Panel command was rejected or unconfirmed');
		}
		record('panel.command.resolved');
		if (!(await binding.readBackMatches(binding.targetPanelValue))) {
			throw new Error('Homey mapping-control command read-back did not match');
		}
		record('command.readback.verified');
		record('restoration.requested');
		if (!(await binding.command(binding.baselinePanelValue))) {
			throw new Error('Homey mapping-control restoration was rejected or unconfirmed');
		}
		record('restoration.resolved');
		if (!(await binding.readBackMatches(binding.baselinePanelValue))) {
			throw new Error('Homey mapping-control restoration read-back did not match');
		}
		record('restoration.readback.verified');
		restored = true;
	} catch (error) {
		operationError = error;
	} finally {
		if (commandAttempted && binding !== undefined && !restored) {
			try {
				const accepted = await binding.command(binding.baselinePanelValue);
				const matched = accepted && (await binding.readBackMatches(binding.baselinePanelValue));

				if (!matched) cleanupFailures.push('capability restoration');
				else restored = true;
			} catch {
				cleanupFailures.push('capability restoration');
			}
		}

		try {
			await runtime.stop();
			record('service.stop.resolved');
		} catch {
			cleanupFailures.push('service stop');
		}
	}

	if (cleanupFailures.length > 0) {
		throw new Error(`Homey mapping-control cleanup failed: ${cleanupFailures.join(', ')}`);
	}
	if (operationError !== undefined) throw operationError;
	if (binding === undefined || !restored) throw new Error('Homey mapping-control verification failed');

	return {
		metadata: { probe: 'homey-shs-mapping-control', schemaVersion: 1, sdkVersion: SDK_VERSION },
		observation: {
			availableFamilies: [...binding.availableFamilies],
			baselineRead: true,
			commandReadBackMatched: true,
			family: config.family,
			mappingName: config.mappingName,
			panelCommandAccepted: true,
			restorationAccepted: true,
			restorationReadBackMatched: true,
			restored: true,
		},
		session: { cleanupCompleted: true, events, serviceStarted: true },
	};
};

const requireExactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
		throw new Error(`Homey mapping-control report ${label} schema is invalid`);
	}

	return value;
};

export function assertHomeyShsMappingControlReportSafe(
	value: unknown,
	config: HomeyShsMappingControlConfig,
): asserts value is HomeyShsMappingControlReport {
	const report = requireExactKeys(value, ['metadata', 'observation', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const observation = requireExactKeys(
		report.observation,
		[
			'availableFamilies',
			'baselineRead',
			'commandReadBackMatched',
			'family',
			'mappingName',
			'panelCommandAccepted',
			'restorationAccepted',
			'restorationReadBackMatched',
			'restored',
		],
		'observation',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'serviceStarted'], 'session');

	if (
		metadata.probe !== 'homey-shs-mapping-control' ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION
	) {
		throw new Error('Homey mapping-control report metadata is invalid');
	}
	if (
		!HOMEY_MAPPING_CONTROL_FAMILIES.includes(observation.family as HomeyMappingControlFamily) ||
		typeof observation.mappingName !== 'string' ||
		!HOMEY_MAPPING_CONTROL_MAPPINGS[observation.family as HomeyMappingControlFamily].includes(
			observation.mappingName,
		) ||
		observation.family !== config.family ||
		observation.mappingName !== config.mappingName
	) {
		throw new Error('Homey mapping-control report target is invalid');
	}
	if (!Array.isArray(observation.availableFamilies)) {
		throw new Error('Homey mapping-control report available families are invalid');
	}
	const availableFamilies = observation.availableFamilies as unknown[];
	const normalizedAvailableFamilies = HOMEY_MAPPING_CONTROL_FAMILIES.filter((family) =>
		availableFamilies.includes(family),
	);

	if (
		availableFamilies.length === 0 ||
		availableFamilies.some((family) => !HOMEY_MAPPING_CONTROL_FAMILIES.includes(family as HomeyMappingControlFamily)) ||
		normalizedAvailableFamilies.length !== availableFamilies.length ||
		availableFamilies.some((family, index) => family !== normalizedAvailableFamilies[index]) ||
		!availableFamilies.includes(observation.family)
	) {
		throw new Error('Homey mapping-control report available families are invalid');
	}
	for (const key of [
		'baselineRead',
		'commandReadBackMatched',
		'panelCommandAccepted',
		'restorationAccepted',
		'restorationReadBackMatched',
		'restored',
	] as const) {
		if (observation[key] !== true) throw new Error('Homey mapping-control report did not verify the complete command');
	}
	if (session.cleanupCompleted !== true || session.serviceStarted !== true || !Array.isArray(session.events)) {
		throw new Error('Homey mapping-control report session is invalid');
	}
	for (const [index, event] of session.events.entries()) {
		if (
			!isRecord(event) ||
			Object.keys(event).sort().join() !== 'event,order' ||
			typeof event.event !== 'string' ||
			!SAFE_EVENTS.has(event.event as MappingControlEvent) ||
			event.order !== index + 1
		) {
			throw new Error('Homey mapping-control report event is invalid');
		}
	}
	const labels = session.events.map((event) => (event as { event: string }).event);
	let previousIndex = -1;

	for (const label of [
		'service.start.requested',
		'service.start.resolved',
		'inventory.verified',
		'target.bound',
		'baseline.read.verified',
		'panel.command.requested',
		'panel.command.resolved',
		'command.readback.verified',
		'restoration.requested',
		'restoration.resolved',
		'restoration.readback.verified',
		'service.stop.resolved',
	]) {
		const index = labels.indexOf(label);

		if (index <= previousIndex) throw new Error('Homey mapping-control report ordering is invalid');
		previousIndex = index;
	}
	const serialized = JSON.stringify(value).toLowerCase();
	const forbidden = [
		config.apiKey,
		config.expectedHost,
		config.target.deviceId,
		config.target.capabilityId,
		...config.privateTerms,
	]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (
		forbidden.some((item) => serialized.includes(item)) ||
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey mapping-control report contains a private value');
	}
}

export const writeHomeyShsMappingControlReport = async (
	report: HomeyShsMappingControlReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `mapping-control-${suffix}`);

	await mkdir(outputRoot, { mode: 0o700, recursive: true });
	await mkdir(outputDirectory, { mode: 0o700, recursive: false });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const main = async (): Promise<void> => {
	try {
		const config = loadHomeyShsMappingControlConfig(process.env);
		process.stdout.write(
			`Homey ${config.family} mapping-control probe is using the Smart Panel production command path and will restore the original value.\n`,
		);
		const report = await probeHomeyShsMappingControl(config);
		assertHomeyShsMappingControlReportSafe(report, config);
		const outputDirectory = await writeHomeyShsMappingControlReport(report, config.outputRoot);
		process.stdout.write(`Sanitized Homey mapping-control report written to ${outputDirectory}.\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey mapping-control probe failed'}\n`);
		process.exitCode = 1;
	}
};

if (require.main === module) void main();
