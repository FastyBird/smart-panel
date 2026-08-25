import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';

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
const FIXTURE_ROOT = resolve(BACKEND_ROOT, 'src/plugins/devices-homey/__fixtures__');
const OPENAPI_PATH = resolve(REPOSITORY_ROOT, 'spec/api/v1/openapi.json');
const SNAPSHOT_ROOT = resolve(REPOSITORY_ROOT, 'apps');
const BUILD_EXTENSIONS = new Set(['.js', '.json', '.map']);
const SECRET_PROPERTY_PATTERN =
	/^(?:access[_-]?token|api[_-]?key|authorization|credential|password|refresh[_-]?token|secret)$/i;
const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
	{
		label: 'private IPv4 address',
		pattern: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/,
	},
	{ label: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
	{ label: 'Homey personal access token', pattern: /\b(?:hpat|pat)_[A-Za-z0-9_-]{16,}\b/i },
	{
		label: 'serialized secret value',
		pattern:
			/["'](?:access[_-]?token|api[_-]?key|authorization|credential|password|refresh[_-]?token|secret)["']\s*:\s*["'](?!\[~3~\])[^"]+["']/i,
	},
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
		process.env.FB_HOMEY_SHS_EXPECTED_HOST,
		...(process.env.FB_HOMEY_SHS_PRIVATE_TERMS?.split(',') ?? []),
	]
		.map((value) => value?.trim())
		.filter((value): value is string => value !== undefined && value.length >= 4);

const assertTextSafe = (label: string, text: string): void => {
	for (const forbidden of FORBIDDEN_PATTERNS) {
		if (forbidden.pattern.test(text)) {
			throw new Error(`${label} contains a ${forbidden.label}`);
		}
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

		if (SECRET_PROPERTY_PATTERN.test(key) && child !== null && typeof child === 'object') {
			const secretSchema = child as JsonRecord;

			if (secretSchema.writeOnly !== true) {
				throw new Error(`${schemaName}.${childPath.join('.')} is not write-only`);
			}

			for (const forbiddenKeyword of ['default', 'enum', 'example', 'examples']) {
				if (forbiddenKeyword in secretSchema) {
					throw new Error(`${schemaName}.${childPath.join('.')} publishes ${forbiddenKeyword}`);
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
		const fixtureFiles = collectFiles(FIXTURE_ROOT, (path) => extname(path) === '.json');
		const snapshotFiles = collectFiles(SNAPSHOT_ROOT, (path) => path.endsWith('.snap')).filter(
			(path) => path.toLocaleLowerCase().includes('homey') || readFileSync(path, 'utf8').includes('devices-homey'),
		);

		expect(fixtureFiles.length).toBeGreaterThan(0);

		for (const path of [...fixtureFiles, ...snapshotFiles]) {
			assertTextSafe(path.slice(REPOSITORY_ROOT.length + 1), readFileSync(path, 'utf8'));
		}
	});

	it('keeps compiled Homey backend artifacts free of private values', () => {
		const buildFiles = collectFiles(
			BUILD_ROOT,
			(path) => path.endsWith('.d.ts') || BUILD_EXTENSIONS.has(extname(path)),
		);

		if (process.env.HOMEY_SECURITY_REQUIRE_BUILD === '1') {
			expect(buildFiles.length).toBeGreaterThan(0);
		}

		for (const path of buildFiles) {
			assertTextSafe(path.slice(BACKEND_ROOT.length + 1), readFileSync(path, 'utf8'));
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
		expect(() => assertTextSafe('unsafe fixture', '{"api_key":"must-not-be-reported"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"192.168.1.23"}')).toThrow(
			'unsafe fixture contains a private IPv4 address',
		);
	});
});
