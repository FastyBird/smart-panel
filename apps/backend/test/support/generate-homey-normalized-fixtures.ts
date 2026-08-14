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
	const zones = transformHomeyLocalZones(await readJson(resolve(sourceRoot, 'zones.json')));

	if (!Array.isArray(manifest.fixtures) || !manifest.fixtures.every((path) => typeof path === 'string')) {
		throw new Error('Homey fixture manifest is malformed');
	}

	await mkdir(devicesRoot, { recursive: true });
	await writeJson(resolve(outputRoot, 'zones.json'), zones);

	for (const fixturePath of manifest.fixtures) {
		const device = transformHomeyLocalDevice(await readJson(resolve(sourceRoot, fixturePath)), zones);
		await writeJson(resolve(devicesRoot, basename(fixturePath)), device);
	}

	await writeJson(resolve(outputRoot, 'manifest.json'), {
		schemaVersion: 1,
		sourceFixtureVersion: basename(await realpath(sourceRoot)),
		fixtures: manifest.fixtures,
	});

	process.stdout.write(`Generated ${manifest.fixtures.length} normalized Homey fixtures.\n`);
};

if (require.main === module) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey fixture generation failed'}\n`);
		process.exitCode = 1;
	});
}
