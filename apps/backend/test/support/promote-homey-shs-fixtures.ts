import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';

import { deriveKnownCoverageGaps, deriveKnownDeviceClassGaps } from './homey-shs-fixture-coverage';
import { HomeyShsCapture, assertHomeyCaptureSafe, sanitizeHomeyPublishedMetadata } from './homey-shs-probe';
import { resolveHomeyTransportPort } from './homey-shs-transport';

const FIXTURE_NAMES = [
	'light',
	'switch',
	'climate',
	'cover',
	'sensor-air-quality',
	'sensor-safety',
	'energy-meter',
	'repeated-capabilities',
	'unavailable',
] as const;

type FixtureName = (typeof FIXTURE_NAMES)[number];
type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8')) as unknown;

const capabilityIds = (device: JsonRecord): string[] =>
	Array.isArray(device.capabilities)
		? device.capabilities.filter((capability): capability is string => typeof capability === 'string')
		: [];

const capabilityBases = (device: JsonRecord): Set<string> =>
	new Set(capabilityIds(device).map((capability) => capability.split('.', 1)[0]));

const hasAllCapabilities = (device: JsonRecord, ...bases: string[]): boolean => {
	const available = capabilityBases(device);

	return bases.every((base) => available.has(base));
};

const suffixedCapabilityCount = (device: JsonRecord): number =>
	capabilityIds(device).filter((capability) => capability.includes('.')).length;

const repeatedBaseCount = (device: JsonRecord): number => {
	const bases = capabilityIds(device).map((capability) => capability.split('.', 1)[0]);

	return bases.length - new Set(bases).size;
};

interface FixtureSelector {
	name: FixtureName;
	matches(device: JsonRecord): boolean;
	score(device: JsonRecord): number;
}

const selectors: FixtureSelector[] = [
	{
		name: 'light',
		matches: (device) => device.class === 'light' && hasAllCapabilities(device, 'onoff', 'dim'),
		score: (device) =>
			['light_hue', 'light_saturation', 'light_temperature'].filter((capability) =>
				capabilityBases(device).has(capability),
			).length,
	},
	{
		name: 'switch',
		matches: (device) => device.class === 'socket' && hasAllCapabilities(device, 'onoff'),
		score: (device) => Number(hasAllCapabilities(device, 'measure_power', 'meter_power')),
	},
	{
		name: 'climate',
		matches: (device) => hasAllCapabilities(device, 'measure_temperature', 'measure_humidity'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'cover',
		matches: (device) =>
			device.class === 'windowcoverings' && hasAllCapabilities(device, 'windowcoverings_state', 'windowcoverings_set'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'sensor-air-quality',
		matches: (device) =>
			device.class === 'sensor' &&
			hasAllCapabilities(device, 'measure_temperature', 'measure_humidity', 'measure_luminance'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'sensor-safety',
		matches: (device) => hasAllCapabilities(device, 'alarm_motion') || hasAllCapabilities(device, 'alarm_battery'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'energy-meter',
		matches: (device) => hasAllCapabilities(device, 'measure_power', 'meter_power'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'repeated-capabilities',
		matches: (device) => repeatedBaseCount(device) > 0,
		score: (device) => repeatedBaseCount(device) * 100 + suffixedCapabilityCount(device),
	},
	{
		name: 'unavailable',
		matches: (device) => device.available === false,
		score: (device) => capabilityIds(device).length,
	},
];

const selectFixtures = (devices: JsonRecord): Map<FixtureName, JsonRecord> => {
	const entries = Object.entries(devices).sort(([left], [right]) => left.localeCompare(right));
	const selectedIds = new Set<string>();
	const selected = new Map<FixtureName, JsonRecord>();
	const matchingCandidateCount = (selector: FixtureSelector): number =>
		entries.filter(([, device]) => isRecord(device) && selector.matches(device)).length;
	const orderedSelectors = [...selectors].sort(
		(left, right) => matchingCandidateCount(left) - matchingCandidateCount(right),
	);

	for (const selector of orderedSelectors) {
		const candidates = entries
			.filter(([id, device]) => !selectedIds.has(id) && isRecord(device) && selector.matches(device))
			.sort(([leftId, left], [rightId, right]) => {
				if (!isRecord(left) || !isRecord(right)) {
					return leftId.localeCompare(rightId);
				}

				return selector.score(right) - selector.score(left) || leftId.localeCompare(rightId);
			});
		const candidate = candidates[0];

		if (!candidate || !isRecord(candidate[1])) {
			throw new Error(`Sanitized Homey capture has no distinct candidate for fixture '${selector.name}'`);
		}

		selectedIds.add(candidate[0]);
		selected.set(selector.name, candidate[1]);
	}

	return selected;
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
	const formatted = await format(JSON.stringify(value), {
		parser: 'json',
		printWidth: 120,
		tabWidth: 2,
		useTabs: true,
	});

	await writeFile(path, formatted, { encoding: 'utf8', mode: 0o644 });
};

const fixtureProvenance = (metadata: JsonRecord): JsonRecord => {
	const capturedAt = metadata.capturedAt;
	const homey = metadata.homey;
	const transport = metadata.transport;

	if (
		typeof capturedAt !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T/.test(capturedAt) ||
		!isRecord(homey) ||
		typeof homey.version !== 'string' ||
		!isRecord(transport) ||
		typeof transport.protocol !== 'string' ||
		(typeof transport.port !== 'string' && typeof transport.port !== 'number')
	) {
		throw new Error('Sanitized Homey capture metadata is missing fixture provenance');
	}

	return {
		captureDate: capturedAt.slice(0, 10),
		homeyVersion: homey.version,
		transport: {
			protocol: transport.protocol,
			port: resolveHomeyTransportPort(transport.protocol, transport.port),
		},
		sanitized: true,
	};
};

const main = async (): Promise<void> => {
	const captureDirectory = process.argv.slice(2).find((argument) => argument !== '--');

	if (!captureDirectory) {
		throw new Error('Usage: pnpm run homey:promote-fixtures -- <sanitized-capture-directory>');
	}

	const sourceRoot = resolve(captureDirectory);
	const outputRoot = resolve(__dirname, '../../src/plugins/devices-homey/__fixtures__');
	const capture: HomeyShsCapture = {
		metadata: (await readJson(resolve(sourceRoot, 'metadata.json'))) as Record<string, unknown>,
		systemInfo: await readJson(resolve(sourceRoot, 'systemInfo.json')),
		zones: await readJson(resolve(sourceRoot, 'zones.json')),
		devices: await readJson(resolve(sourceRoot, 'devices.json')),
	};

	if (!isRecord(capture.devices) || !isRecord(capture.zones)) {
		throw new Error('Sanitized Homey capture collections are malformed');
	}

	const publishedZones = sanitizeHomeyPublishedMetadata(capture.zones, true);
	const publishedDevices = sanitizeHomeyPublishedMetadata(capture.devices);

	if (!isRecord(publishedZones) || !isRecord(publishedDevices)) {
		throw new Error('Sanitized Homey capture collections are malformed after metadata redaction');
	}

	capture.systemInfo = sanitizeHomeyPublishedMetadata(capture.systemInfo);
	capture.zones = publishedZones;
	capture.devices = publishedDevices;
	assertHomeyCaptureSafe(capture, []);

	const fixtures = selectFixtures(publishedDevices);
	const devicesRoot = resolve(outputRoot, 'devices');

	await mkdir(devicesRoot, { recursive: true });
	await writeJson(resolve(outputRoot, 'system-info.json'), capture.systemInfo);
	await writeJson(resolve(outputRoot, 'zones.json'), capture.zones);

	for (const [name, device] of fixtures) {
		assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices: { [name]: device } }, []);
		await writeJson(resolve(devicesRoot, `${name}.json`), device);
	}

	await writeJson(resolve(outputRoot, 'manifest.json'), {
		schemaVersion: 1,
		provenance: fixtureProvenance(capture.metadata),
		fixtures: FIXTURE_NAMES.map((name) => `devices/${name}.json`),
		knownCoverageGaps: deriveKnownCoverageGaps(publishedDevices),
		knownDeviceClassGaps: deriveKnownDeviceClassGaps(publishedDevices),
	});

	process.stdout.write(`Promoted ${fixtures.size} sanitized Homey fixtures.\n`);
};

if (require.main === module) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey fixture promotion failed'}\n`);
		process.exitCode = 1;
	});
}
