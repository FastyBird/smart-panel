import { readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import ts from 'typescript';

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

const homeyApiModuleSpecifiers = (source: string): readonly string[] => {
	const sourceFile = ts.createSourceFile('production.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const specifiers: string[] = [];
	const addSpecifier = (node: ts.Expression | undefined): void => {
		if (
			node !== undefined &&
			ts.isStringLiteralLike(node) &&
			(node.text === 'homey-api' || node.text.startsWith('homey-api/'))
		) {
			specifiers.push(node.text);
		}
	};
	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			addSpecifier(node.moduleSpecifier);
		} else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
			addSpecifier(node.moduleReference.expression);
		} else if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) && node.expression.text === 'require'))
		) {
			addSpecifier(node.arguments[0]);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return specifiers;
};

describe('Homey production boundary', () => {
	it('locks the provider boundary to reads, subscriptions, and capability writes', () => {
		const allowedOperations = [
			'connect',
			'disconnect',
			'getDevice',
			'getDevices',
			'getSystemInfo',
			'getZones',
			'setCapabilityValue',
			'subscribe',
		];

		expect(Object.keys(CONNECTOR_SURFACE).sort()).toStrictEqual(allowedOperations);
		expect(Object.keys(LOCAL_TRANSPORT_SURFACE).sort()).toStrictEqual(allowedOperations);
	});

	it('keeps the reviewed SDK surface free of upstream lifecycle mutations', () => {
		expect(Object.keys(SDK_CLIENT_SURFACE).sort()).toStrictEqual([
			'destroy',
			'devices',
			'disconnect',
			'id',
			'name',
			'system',
			'version',
			'zones',
		]);
		expect(Object.keys(SDK_DEVICE_SURFACE).sort()).toStrictEqual([
			'available',
			'connect',
			'disconnect',
			'id',
			'off',
			'on',
		]);
		expect(Object.keys(SDK_DEVICES_MANAGER_SURFACE).sort()).toStrictEqual([
			'connect',
			'disconnect',
			'getDevice',
			'getDevices',
			'off',
			'on',
			'setCapabilityValue',
		]);
		expect(Object.keys(SDK_SYSTEM_MANAGER_SURFACE)).toStrictEqual(['getInfo']);
		expect(Object.keys(SDK_ZONES_MANAGER_SURFACE).sort()).toStrictEqual([
			'connect',
			'disconnect',
			'getZones',
			'off',
			'on',
		]);
	});

	it('allows only the reviewed SDK client adapter to import homey-api', () => {
		const importers = collectProductionTypescript(PLUGIN_ROOT)
			.filter((path) => homeyApiModuleSpecifiers(readFileSync(path, 'utf8')).length > 0)
			.map((path) => relative(PLUGIN_ROOT, path));

		expect(importers).toStrictEqual([relative(PLUGIN_ROOT, SDK_CLIENT_PATH)]);
	});

	it('detects package-root and subpath module specifiers without matching ordinary text', () => {
		expect(
			homeyApiModuleSpecifiers(`
				import root from 'homey-api';
				export { default as local } from 'homey-api/lib/HomeyAPI/HomeyAPIV3Local';
				const dynamic = import('homey-api/lib/HomeyAPI');
				const legacy = require('homey-api/lib/ManagerDevices');
				const ordinary = 'homey-api/lib/not-an-import';
				// import ignored from 'homey-api/lib/comment';
			`),
		).toStrictEqual([
			'homey-api',
			'homey-api/lib/HomeyAPI/HomeyAPIV3Local',
			'homey-api/lib/HomeyAPI',
			'homey-api/lib/ManagerDevices',
		]);
	});
});
