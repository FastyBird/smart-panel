import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';

import {
	assertDistinctHomeyEnumOptionIds,
	deriveKnownCoverageGaps,
	deriveKnownDeviceClassGaps,
	deriveKnownMetadataGaps,
} from './homey-shs-fixture-coverage';
import { buildHomeyFixtureProvenance } from './homey-shs-fixture-manifest';
import { publishHomeyFixtureCorpus } from './homey-shs-fixture-publication';
import { HOMEY_FIXTURE_NAMES, JsonRecord, selectHomeyFixtures } from './homey-shs-fixture-selection';
import {
	HomeyShsCapture,
	assertHomeyCaptureRedacted,
	assertHomeyCaptureSafe,
	sanitizeHomeyPublishedMetadata,
} from './homey-shs-probe';

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8')) as unknown;

const writeJson = async (path: string, value: unknown): Promise<void> => {
	const formatted = await format(JSON.stringify(value), {
		parser: 'json',
		printWidth: 120,
		tabWidth: 2,
		useTabs: true,
	});

	await writeFile(path, formatted, { encoding: 'utf8', mode: 0o644 });
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

	const publishedZones = sanitizeHomeyPublishedMetadata(capture.zones, { redactZoneIcons: true });
	const publishedDevices = sanitizeHomeyPublishedMetadata(capture.devices, { redactDeviceIcons: true });

	if (!isRecord(publishedZones) || !isRecord(publishedDevices)) {
		throw new Error('Sanitized Homey capture collections are malformed after metadata redaction');
	}

	capture.systemInfo = sanitizeHomeyPublishedMetadata(capture.systemInfo, { redactSystemFingerprint: true });
	capture.zones = publishedZones;
	capture.devices = publishedDevices;
	assertHomeyCaptureRedacted(capture);
	assertHomeyCaptureSafe(capture, []);
	assertDistinctHomeyEnumOptionIds(publishedDevices);

	const fixtures = selectHomeyFixtures(publishedDevices);

	for (const [name, device] of fixtures) {
		assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices: { [name]: device } }, []);
	}

	const manifest = {
		schemaVersion: 1,
		provenance: buildHomeyFixtureProvenance(capture.metadata),
		fixtures: HOMEY_FIXTURE_NAMES.map((name) => `devices/${name}.json`),
		knownCoverageGaps: deriveKnownCoverageGaps(publishedDevices),
		knownDeviceClassGaps: deriveKnownDeviceClassGaps(publishedDevices),
		knownMetadataGaps: deriveKnownMetadataGaps(publishedDevices),
		syntheticFixtures: ['synthetic/enum-capability.json'],
	};
	const versionsRoot = resolve(outputRoot, 'versions');
	await mkdir(versionsRoot, { recursive: true });

	const stagingParent = await mkdtemp(resolve(versionsRoot, '.staging-'));
	const stagingRoot = resolve(stagingParent, 'next');
	const provenance = manifest.provenance as { captureDate: string; homeyVersion: string };
	const versionName = `${capture.metadata.capturedAt as string}-shs-${provenance.homeyVersion}`.replaceAll(
		/[^A-Za-z0-9._-]/g,
		'-',
	);

	try {
		await mkdir(stagingRoot, { recursive: true });
		await cp(resolve(outputRoot, 'current/synthetic'), resolve(stagingRoot, 'synthetic'), {
			dereference: true,
			recursive: true,
		});

		const devicesRoot = resolve(stagingRoot, 'devices');

		await mkdir(devicesRoot, { recursive: true });
		await writeJson(resolve(stagingRoot, 'system-info.json'), capture.systemInfo);
		await writeJson(resolve(stagingRoot, 'zones.json'), capture.zones);

		for (const [name, device] of fixtures) {
			await writeJson(resolve(devicesRoot, `${name}.json`), device);
		}

		await writeJson(resolve(stagingRoot, 'manifest.json'), manifest);
		await publishHomeyFixtureCorpus(outputRoot, stagingRoot, versionName);
	} finally {
		await rm(stagingParent, { force: true, recursive: true });
	}

	process.stdout.write(`Promoted ${fixtures.size} sanitized Homey fixtures.\n`);
};

if (require.main === module) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey fixture promotion failed'}\n`);
		process.exitCode = 1;
	});
}
