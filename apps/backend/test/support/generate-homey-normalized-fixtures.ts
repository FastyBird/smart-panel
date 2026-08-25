import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { format } from 'prettier';

import {
	transformHomeyLocalDevice,
	transformHomeyLocalZones,
} from '../../src/plugins/devices-homey/connectors/homey-local.transformer';

interface HomeyFixtureManifest {
	fixtures: string[];
}

interface HomeySyntheticFixtureManifest {
	deviceFixtures: string[];
	schemaVersion: number;
	version: string;
}

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8')) as unknown;

const writeJson = async (path: string, value: unknown): Promise<void> => {
	const contents = await format(JSON.stringify(value), {
		parser: 'json',
		printWidth: 120,
		tabWidth: 2,
		useTabs: true,
	});

	await writeFile(path, contents, { encoding: 'utf8', mode: 0o644 });
};

const main = async (): Promise<void> => {
	const fixtureRoot = resolve(__dirname, '../../src/plugins/devices-homey/__fixtures__');
	const sourceRoot = resolve(fixtureRoot, 'current');
	const outputRoot = resolve(fixtureRoot, 'expected/v1');
	const devicesRoot = resolve(outputRoot, 'devices');
	const manifest = (await readJson(resolve(sourceRoot, 'manifest.json'))) as HomeyFixtureManifest;
	const syntheticManifest = (await readJson(
		resolve(fixtureRoot, 'synthetic/manifest.json'),
	)) as HomeySyntheticFixtureManifest;
	const zones = transformHomeyLocalZones(await readJson(resolve(sourceRoot, 'zones.json')));

	if (
		!Array.isArray(manifest.fixtures) ||
		!manifest.fixtures.every((path) => typeof path === 'string') ||
		syntheticManifest.schemaVersion !== 1 ||
		typeof syntheticManifest.version !== 'string' ||
		!/^[A-Za-z0-9._-]+$/.test(syntheticManifest.version) ||
		!Array.isArray(syntheticManifest.deviceFixtures) ||
		!syntheticManifest.deviceFixtures.every((path) => typeof path === 'string')
	) {
		throw new Error('Homey fixture manifest is malformed');
	}

	const syntheticSourceRoot = resolve(fixtureRoot, 'synthetic', syntheticManifest.version);

	await mkdir(devicesRoot, { recursive: true });
	await writeJson(resolve(outputRoot, 'zones.json'), zones);

	for (const fixturePath of manifest.fixtures) {
		const device = transformHomeyLocalDevice(await readJson(resolve(sourceRoot, fixturePath)), zones);
		await writeJson(resolve(devicesRoot, basename(fixturePath)), device);
	}

	for (const fixturePath of syntheticManifest.deviceFixtures) {
		const device = transformHomeyLocalDevice(await readJson(resolve(syntheticSourceRoot, fixturePath)), zones);
		const syntheticDeviceRoot = resolve(outputRoot, 'synthetic/devices');

		await mkdir(syntheticDeviceRoot, { recursive: true });
		await writeJson(resolve(syntheticDeviceRoot, basename(fixturePath)), device);
	}

	await writeJson(resolve(outputRoot, 'manifest.json'), {
		schemaVersion: 1,
		sourceFixtureVersion: basename(await realpath(sourceRoot)),
		fixtures: manifest.fixtures,
		syntheticFixtureVersion: syntheticManifest.version,
		syntheticDeviceFixtures: syntheticManifest.deviceFixtures,
	});

	process.stdout.write(
		`Generated ${manifest.fixtures.length} captured and ${syntheticManifest.deviceFixtures.length} synthetic normalized Homey fixtures.\n`,
	);
};

if (require.main === module) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey fixture generation failed'}\n`);
		process.exitCode = 1;
	});
}
