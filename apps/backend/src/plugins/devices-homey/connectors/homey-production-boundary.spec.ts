import { readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

import { HomeyConnector } from './homey-connector.interface';
import { HomeyLocalTransport } from './homey-local.transport';
import {
	HomeySdkClient,
	HomeySdkDevice,
	HomeySdkDevicesManager,
	HomeySdkSystemManager,
	HomeySdkZonesManager,
} from './homey-sdk.client';

const CONNECTOR_SURFACE = {
	connect: true,
	disconnect: true,
	getDevice: true,
	getDevices: true,
	getSystemInfo: true,
	getZones: true,
	setCapabilityValue: true,
	subscribe: true,
} satisfies Record<keyof HomeyConnector, true>;

const LOCAL_TRANSPORT_SURFACE = {
	connect: true,
	disconnect: true,
	getDevice: true,
	getDevices: true,
	getSystemInfo: true,
	getZones: true,
	setCapabilityValue: true,
	subscribe: true,
} satisfies Record<keyof HomeyLocalTransport, true>;

const SDK_CLIENT_SURFACE = {
	destroy: true,
	devices: true,
	disconnect: true,
	id: true,
	name: true,
	system: true,
	version: true,
	zones: true,
} satisfies Record<keyof HomeySdkClient, true>;

const SDK_DEVICE_SURFACE = {
	available: true,
	connect: true,
	disconnect: true,
	id: true,
	off: true,
	on: true,
} satisfies Record<keyof HomeySdkDevice, true>;

const SDK_DEVICES_MANAGER_SURFACE = {
	connect: true,
	disconnect: true,
	getDevice: true,
	getDevices: true,
	off: true,
	on: true,
	setCapabilityValue: true,
} satisfies Record<keyof HomeySdkDevicesManager, true>;

const SDK_SYSTEM_MANAGER_SURFACE = {
	getInfo: true,
} satisfies Record<keyof HomeySdkSystemManager, true>;

const SDK_ZONES_MANAGER_SURFACE = {
	connect: true,
	disconnect: true,
	getZones: true,
	off: true,
	on: true,
} satisfies Record<keyof HomeySdkZonesManager, true>;

const FORBIDDEN_UPSTREAM_OPERATIONS = new Set([
	'addDevice',
	'createDevice',
	'createPairSession',
	'deleteDevice',
	'drivers',
	'getPairSession',
	'pairDevice',
	'removeDevice',
	'renameDevice',
	'updateDevice',
]);

const PLUGIN_ROOT = resolve(__dirname, '..');
const SDK_CLIENT_PATH = resolve(__dirname, 'homey-sdk.client.ts');

const collectProductionTypescript = (root: string): readonly string[] =>
	readdirSync(root, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		const path = resolve(root, entry.name);

		if (entry.isDirectory()) {
			return collectProductionTypescript(path);
		}

		return entry.isFile() && extname(path) === '.ts' && !path.endsWith('.spec.ts') ? [path] : [];
	});

describe('Homey production boundary', () => {
	it('locks the provider boundary to reads, subscriptions, and capability writes', () => {
		expect(Object.keys(CONNECTOR_SURFACE).sort()).toStrictEqual(Object.keys(LOCAL_TRANSPORT_SURFACE).sort());
		expect(
			Object.keys(CONNECTOR_SURFACE).filter((operation) => FORBIDDEN_UPSTREAM_OPERATIONS.has(operation)),
		).toStrictEqual([]);
	});

	it('keeps the reviewed SDK surface free of upstream lifecycle mutations', () => {
		const sdkSurface = [
			...Object.keys(SDK_CLIENT_SURFACE),
			...Object.keys(SDK_DEVICE_SURFACE),
			...Object.keys(SDK_DEVICES_MANAGER_SURFACE),
			...Object.keys(SDK_SYSTEM_MANAGER_SURFACE),
			...Object.keys(SDK_ZONES_MANAGER_SURFACE),
		];

		expect(sdkSurface.filter((operation) => FORBIDDEN_UPSTREAM_OPERATIONS.has(operation))).toStrictEqual([]);
	});

	it('allows only the reviewed SDK client adapter to import homey-api', () => {
		const importers = collectProductionTypescript(PLUGIN_ROOT)
			.filter((path) => {
				const source = readFileSync(path, 'utf8');

				return source.includes("'homey-api'") || source.includes('"homey-api"');
			})
			.map((path) => relative(PLUGIN_ROOT, path));

		expect(importers).toStrictEqual([relative(PLUGIN_ROOT, SDK_CLIENT_PATH)]);
	});
});
