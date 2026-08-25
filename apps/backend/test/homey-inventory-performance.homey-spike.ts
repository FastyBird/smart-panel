import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
	transformHomeyLocalDevices,
	transformHomeyLocalZones,
} from '../src/plugins/devices-homey/connectors/homey-local.transformer';
import { HomeyMappingLoaderService } from '../src/plugins/devices-homey/mappings/mapping-loader.service';

interface HomeyFixtureManifest {
	fixtures: string[];
}

type JsonRecord = Record<string, unknown>;

const INVENTORY_SIZE = 250;
const SAMPLE_COUNT = 30;
const WARMUP_COUNT = 3;
const P95_REGRESSION_BUDGET_MS = 1000;
const FIXTURE_ROOT = resolve(__dirname, '../src/plugins/devices-homey/__fixtures__/current');

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const percentile = (samples: readonly number[], ratio: number): number => {
	const sorted = [...samples].sort((left, right) => left - right);
	const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);

	return sorted[index] ?? 0;
};

const buildFixtureGeneratedInventory = (): JsonRecord => {
	const manifest = readJson(resolve(FIXTURE_ROOT, 'manifest.json')) as HomeyFixtureManifest;
	const sourceDevices = manifest.fixtures.map(
		(fixturePath) => readJson(resolve(FIXTURE_ROOT, fixturePath)) as JsonRecord,
	);

	if (sourceDevices.length === 0) {
		throw new Error('Homey performance gate requires at least one captured device fixture');
	}

	return Object.fromEntries(
		Array.from({ length: INVENTORY_SIZE }, (_, index) => {
			const source = structuredClone(sourceDevices[index % sourceDevices.length]);
			const id = `performance-device-${index.toString().padStart(3, '0')}`;

			source.id = id;
			source.name = `Performance device ${index.toString().padStart(3, '0')}`;

			return [id, source];
		}),
	);
};

describe('Homey inventory performance gate', () => {
	it('normalizes and resolves mappings for 250 fixture-generated devices within the regression budget', () => {
		const rawInventory = buildFixtureGeneratedInventory();
		const zones = transformHomeyLocalZones(readJson(resolve(FIXTURE_ROOT, 'zones.json')));
		const loader = new HomeyMappingLoaderService();
		loader.loadAllMappings();
		let normalizedCount = 0;
		let conflictCount = 0;
		let propertyBindingCount = 0;

		const run = (): number => {
			const startedAt = performance.now();
			const devices = transformHomeyLocalDevices(rawInventory, zones);
			let conflicts = 0;
			let propertyBindings = 0;

			for (const device of devices) {
				const deviceResolution = loader.resolveDeviceMappings(device);
				const channelResolution = loader.resolveChannelMappings(device);
				const propertyResolution = loader.resolvePropertyMappings(device);

				conflicts +=
					deviceResolution.conflicts.length + channelResolution.conflicts.length + propertyResolution.conflicts.length;
				propertyBindings += propertyResolution.mappings.length;
			}

			normalizedCount = devices.length;
			conflictCount = conflicts;
			propertyBindingCount = propertyBindings;

			return performance.now() - startedAt;
		};

		for (let index = 0; index < WARMUP_COUNT; index += 1) {
			run();
		}

		const samples = Array.from({ length: SAMPLE_COUNT }, run);
		const p50Ms = percentile(samples, 0.5);
		const p95Ms = percentile(samples, 0.95);
		const maximumMs = Math.max(...samples);

		expect(normalizedCount).toBe(INVENTORY_SIZE);
		expect(conflictCount).toBe(0);
		expect(propertyBindingCount).toBeGreaterThan(0);
		expect(p95Ms).toBeLessThan(P95_REGRESSION_BUDGET_MS);

		process.stdout.write(
			`Homey ${INVENTORY_SIZE}-device inventory gate: p50=${p50Ms.toFixed(2)}ms, p95=${p95Ms.toFixed(2)}ms, max=${maximumMs.toFixed(2)}ms.\n`,
		);
	});
});
