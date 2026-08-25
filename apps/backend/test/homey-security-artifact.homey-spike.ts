import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { extname, resolve } from 'node:path';
import ts from 'typescript';

import { isHomeySecretKey } from './support/homey-shs-probe';

type JsonRecord = Record<string, unknown>;

interface OpenApiDocument {
	components?: {
		schemas?: Record<string, unknown>;
	};
	paths?: Record<string, unknown>;
}

interface ForbiddenPattern {
	readonly label: string;
	readonly pattern: RegExp;
}

const BACKEND_ROOT = resolve(__dirname, '..');
const REPOSITORY_ROOT = resolve(__dirname, '../../..');
const BUILD_ROOT = resolve(BACKEND_ROOT, 'dist/plugins/devices-homey');
const FIXTURE_REPOSITORY_PATH = 'apps/backend/src/plugins/devices-homey/__fixtures__';
const OPENAPI_PATH = resolve(REPOSITORY_ROOT, 'spec/api/v1/openapi.json');
const SNAPSHOT_ROOT = resolve(REPOSITORY_ROOT, 'apps');
const BUILD_EXTENSIONS = new Set(['.js', '.json', '.map']);
const FIXTURE_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yaml', '.yml']);
const IP_ADDRESS_CANDIDATE_PATTERN = /[A-Za-z0-9:.%_-]{2,}/g;
const HOMEY_TOKEN_PATTERN = /\b(?:homey|hpat|pat)_[A-Za-z0-9_-]{16,}\b/i;
const COMPILED_SYMBOL_NAME_PATTERN = /^[A-Z][A-Z0-9_]+$/;
const COMMENT_PATTERN = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
const SERIALIZED_STRING_PROPERTY_PATTERN = /(["'])([^"']+)\1\s*:\s*(["'])([^"']*)\3/g;
const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
	{
		label: 'an IPv4 address',
		pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
	},
	{ label: 'a MAC address', pattern: /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/i },
	{ label: 'an email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
];

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const collectFiles = (root: string, include: (path: string) => boolean): string[] => {
	if (!existsSync(root)) {
		return [];
	}

	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(root, entry.name);

		if (entry.isDirectory()) {
			return collectFiles(path, include);
		}

		return entry.isFile() && include(path) ? [path] : [];
	});
};

const configuredPrivateValues = (): readonly string[] =>
	[
		process.env.FB_HOMEY_SHS_API_KEY,
		process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY,
		process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY,
		process.env.FB_HOMEY_SHS_EXPECTED_HOST,
		...(process.env.FB_HOMEY_SHS_PRIVATE_TERMS?.split(',') ?? []),
	]
		.map((value) => value?.trim())
		.filter((value): value is string => value !== undefined && value.length >= 3);

const trackedFixtureFiles = (): readonly string[] => {
	const output = execFileSync('git', ['ls-files', '-z', '--', FIXTURE_REPOSITORY_PATH], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
	});

	return output
		.split('\0')
		.filter((path) => path.length > 0)
		.map((path) => resolve(REPOSITORY_ROOT, path))
		.filter((path) => lstatSync(path).isFile());
};

const containsIpv6Address = (text: string): boolean =>
	[...text.matchAll(IP_ADDRESS_CANDIDATE_PATTERN)].some((match) => {
		const candidate = match[0].replace(/^\.+|\.+$/g, '').split('%')[0];

		return candidate !== undefined && candidate !== '::' && isIP(candidate) === 6;
	});

const containsHomeyToken = (text: string, compiledSource: boolean): boolean => {
	if (!compiledSource) {
		return HOMEY_TOKEN_PATTERN.test(text);
	}

	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = [...text.matchAll(COMMENT_PATTERN)].some((match) => HOMEY_TOKEN_PATTERN.test(match[0]));
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			node.kind === ts.SyntaxKind.TemplateHead ||
			node.kind === ts.SyntaxKind.TemplateMiddle ||
			node.kind === ts.SyntaxKind.TemplateTail
		) {
			const value = (node as ts.StringLiteralLike).text;

			found = !COMPILED_SYMBOL_NAME_PATTERN.test(value) && HOMEY_TOKEN_PATTERN.test(value);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsSerializedSecret = (text: string): boolean =>
	[...text.matchAll(SERIALIZED_STRING_PROPERTY_PATTERN)].some((match) => {
		const key = match[2];
		const value = match[4];

		return key !== undefined && isHomeySecretKey(key) && value !== undefined && value.length > 0 && value !== '[~3~]';
	});

const assertTextSafe = (label: string, text: string, compiledSource = false): void => {
	for (const forbidden of FORBIDDEN_PATTERNS) {
		if (forbidden.pattern.test(text)) {
			throw new Error(`${label} contains ${forbidden.label}`);
		}
	}

	if (containsIpv6Address(text)) {
		throw new Error(`${label} contains an IPv6 address`);
	}

	if (containsHomeyToken(text, compiledSource)) {
		throw new Error(`${label} contains a Homey personal access token`);
	}

	if (containsSerializedSecret(text)) {
		throw new Error(`${label} contains a serialized secret value`);
	}

	for (const privateValue of configuredPrivateValues()) {
		if (text.toLocaleLowerCase().includes(privateValue.toLocaleLowerCase())) {
			throw new Error(`${label} contains a configured private Homey value`);
		}
	}
};

const visitSchema = (schemaName: string, value: unknown, path: readonly string[] = []): void => {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => visitSchema(schemaName, entry, [...path, index.toString()]));

		return;
	}

	if (value === null || typeof value !== 'object') {
		return;
	}

	for (const [key, child] of Object.entries(value as JsonRecord)) {
		const childPath = [...path, key];

		if (child !== null && typeof child === 'object') {
			const secretSchema = child as JsonRecord;

			if (isHomeySecretKey(key) && secretSchema.type !== 'boolean') {
				if (secretSchema.writeOnly !== true) {
					throw new Error(`${schemaName}.${childPath.join('.')} is not write-only`);
				}

				for (const forbiddenKeyword of ['default', 'enum', 'example', 'examples']) {
					if (forbiddenKeyword in secretSchema) {
						throw new Error(`${schemaName}.${childPath.join('.')} publishes ${forbiddenKeyword}`);
					}
				}
			}
		}

		visitSchema(schemaName, child, childPath);
	}
};

describe('Homey security artifact gate', () => {
	it('keeps generated Homey OpenAPI schemas and routes secret-safe', () => {
		const document = readJson(OPENAPI_PATH) as OpenApiDocument;
		const homeySchemas = Object.fromEntries(
			Object.entries(document.components?.schemas ?? {}).filter(([name]) => name.startsWith('DevicesHomey')),
		);
		const homeyPaths = Object.fromEntries(
			Object.entries(document.paths ?? {}).filter(([, path]) => JSON.stringify(path).includes('DevicesHomey')),
		);

		expect(Object.keys(homeySchemas).length).toBeGreaterThan(0);
		expect(Object.keys(homeyPaths).length).toBeGreaterThan(0);
		Object.entries(homeySchemas).forEach(([name, schema]) => visitSchema(name, schema));
		assertTextSafe('generated Homey OpenAPI schemas', JSON.stringify(homeySchemas));
		assertTextSafe('generated Homey OpenAPI routes', JSON.stringify(homeyPaths));
	});

	it('keeps committed Homey fixtures and snapshots free of private values', () => {
		const fixtureFiles = trackedFixtureFiles();
		const unsupportedFiles = fixtureFiles.filter((path) => !FIXTURE_EXTENSIONS.has(extname(path)));
		const snapshotFiles = collectFiles(SNAPSHOT_ROOT, (path) => path.endsWith('.snap')).filter(
			(path) => path.toLocaleLowerCase().includes('homey') || readFileSync(path, 'utf8').includes('devices-homey'),
		);

		expect(fixtureFiles.length).toBeGreaterThan(0);
		expect(unsupportedFiles).toEqual([]);

		for (const path of [...fixtureFiles, ...snapshotFiles]) {
			assertTextSafe(path.slice(REPOSITORY_ROOT.length + 1), readFileSync(path, 'utf8'));
		}
	});

	it('keeps compiled Homey backend artifacts free of private values', () => {
		const buildFiles = collectFiles(
			BUILD_ROOT,
			(path) => path.endsWith('.d.ts') || BUILD_EXTENSIONS.has(extname(path)),
		);
		const compiledModuleFiles = buildFiles.filter((path) => path.endsWith('.d.ts') || path.endsWith('.js'));

		if (process.env.HOMEY_SECURITY_REQUIRE_BUILD === '1') {
			expect(compiledModuleFiles.length).toBeGreaterThan(0);
		}

		for (const path of buildFiles) {
			const text = readFileSync(path, 'utf8');

			assertTextSafe(path.slice(BACKEND_ROOT.length + 1), text, path.endsWith('.js') || path.endsWith('.d.ts'));
		}
	});

	it('rejects unsafe secret schemas and private artifact values without echoing them', () => {
		expect(() =>
			visitSchema('UnsafeHomeySchema', {
				properties: { api_key: { type: 'string', example: 'must-not-be-reported' } },
			}),
		).toThrow('UnsafeHomeySchema.properties.api_key is not write-only');
		expect(() =>
			visitSchema('UnsafeHomeySchema', {
				properties: { api_key: { type: 'string', writeOnly: true, example: 'must-not-be-reported' } },
			}),
		).toThrow('UnsafeHomeySchema.properties.api_key publishes example');
		expect(() =>
			visitSchema('UnsafeHomeySchema', {
				properties: { accessToken: { type: 'string' } },
			}),
		).toThrow('UnsafeHomeySchema.properties.accessToken is not write-only');
		expect(() =>
			visitSchema('UnsafeHomeySchema', {
				properties: { pinCode: { type: 'string' } },
			}),
		).toThrow('UnsafeHomeySchema.properties.pinCode is not write-only');
		expect(() => assertTextSafe('unsafe fixture', '{"api_key":"must-not-be-reported"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"cookie":"must-not-be-reported"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"api_key":"[~3~]unredacted-password"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"value":"homey_abcdefghijklmnop"}')).toThrow(
			'unsafe fixture contains a Homey personal access token',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', 'throw new Error("request failed for homey_abcdefghijklmnop")', true),
		).toThrow('unsafe compiled module contains a Homey personal access token');
		expect(() =>
			assertTextSafe('safe compiled module', 'const homey_local_connector_factory_1 = {};', true),
		).not.toThrow();
		expect(() => assertTextSafe('unsafe fixture', '{"address":"192.168.1.23"}')).toThrow(
			'unsafe fixture contains an IPv4 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"169.254.1.20"}')).toThrow(
			'unsafe fixture contains an IPv4 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"fe80::1%en0"}')).toThrow(
			'unsafe fixture contains an IPv6 address',
		);
		const previousPrivateTerms = process.env.FB_HOMEY_SHS_PRIVATE_TERMS;
		const previousReplacementApiKey = process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY;
		const previousDeviceOnlyApiKey = process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY;

		process.env.FB_HOMEY_SHS_PRIVATE_TERMS = 'Ada';
		process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY = 'opaque-replacement-value';
		process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY = 'opaque-device-value';

		try {
			expect(() => assertTextSafe('unsafe fixture', '{"name":"Ada"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"value":"opaque-replacement-value"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"value":"opaque-device-value"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
		} finally {
			if (previousPrivateTerms === undefined) {
				delete process.env.FB_HOMEY_SHS_PRIVATE_TERMS;
			} else {
				process.env.FB_HOMEY_SHS_PRIVATE_TERMS = previousPrivateTerms;
			}

			if (previousReplacementApiKey === undefined) {
				delete process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY;
			} else {
				process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY = previousReplacementApiKey;
			}

			if (previousDeviceOnlyApiKey === undefined) {
				delete process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY;
			} else {
				process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY = previousDeviceOnlyApiKey;
			}
		}
	});
});
