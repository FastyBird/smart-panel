import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import {
	findHomeyIpv6Range,
	isHomeyAddressKey,
	isHomeyGeneratedPseudonym,
	isHomeyPersonalKey,
	isHomeySecretKey,
} from './support/homey-shs-probe';

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
const BUILD_EXTENSIONS = new Set(['.js', '.json', '.map', '.yaml', '.yml']);
const FIXTURE_EXTENSIONS = new Set(['.json', '.md', '.txt', '.yaml', '.yml']);
const IP_ADDRESS_CANDIDATE_PATTERN = /[A-Za-z0-9:.%_-]{2,}/g;
const HOMEY_TOKEN_PATTERN = /(?:homey|hpat|pat)[_-][A-Za-z0-9_-]{16,}/gi;
const PUBLIC_HOMEY_TOKEN_COLLISIONS = new Set([
	'homey_capability_mapping_channel',
	'homey-config-validator',
	'homey-device-inventory',
	'homey-failure-log-limiter',
	'homey-plugin-batch-adoption',
	'homey-plugin-connection',
	'homey-plugin-device-mapping',
	'homey-reconnect-backoff',
]);
const PUBLIC_COMPILED_SECRET_NAMES = new Set(['secretFields']);
const PUBLIC_SYNTHETIC_PERSONAL_VALUES = new Set([
	'Locked',
	'Synthetic lock contract',
	'Synthetic mode A',
	'Synthetic mode B',
	'Synthetic mode C',
]);
const COMPILED_SYMBOL_NAME_PATTERN = /^[A-Z][A-Z0-9_]+$/;
const COMMENT_PATTERN = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
const URL_PATTERN = /(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i;
const PUBLIC_ARTIFACT_URLS = new Set([
	'http://homey.local:4859',
	'http://json-schema.org/draft-07/schema#',
	'https://github.com/FastyBird/smart-panel',
	'https://smart-panel.fastybird.com/docs',
]);
const PUBLIC_HOMEY_HOSTS = new Set(['homey', 'homey.local']);
const SERIALIZED_STRING_PROPERTY_PATTERN = /(["'])([^"']+)\1\s*:\s*(["'])([^"']*)\3/g;
const LOOSE_PROPERTY_PATTERN =
	/(?=(?:^|[{\s,;])["'`]?([A-Za-z][A-Za-z0-9_. -]*)["'`]?\s*[:=]\s*(?:(["'`])([^"'`\r\n]*)\2|([^,;}\r\n`]+)))/gm;
const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
	{
		label: 'an IPv4 address',
		pattern: /(?:\d{1,3}\.){3}\d{1,3}/,
	},
	{
		label: 'a MAC address',
		pattern:
			/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b|\b[0-9a-f]{4}(?:\.[0-9a-f]{4}){2}\b|(?<![0-9a-f-])[0-9a-f]{12}(?![0-9a-f-])/i,
	},
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

const configuredWriteStringValue = (): string | undefined => {
	const rawValue = process.env.FB_HOMEY_SHS_WRITE_VALUE;

	if (rawValue === undefined) {
		return undefined;
	}

	try {
		const value = JSON.parse(rawValue) as unknown;

		return typeof value === 'string' ? value : undefined;
	} catch {
		return undefined;
	}
};

const configuredExpectedHost = (): string | undefined => {
	const value = process.env.FB_HOMEY_SHS_EXPECTED_HOST?.trim();
	const normalizedValue = value?.toLowerCase().replace(/\.$/, '');

	return normalizedValue === undefined || PUBLIC_HOMEY_HOSTS.has(normalizedValue) ? undefined : normalizedValue;
};

const configuredPrivateValues = (): readonly string[] =>
	[
		process.env.FB_HOMEY_SHS_API_KEY,
		process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY,
		process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY,
		configuredExpectedHost(),
		process.env.FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER,
		process.env.FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID,
		process.env.FB_HOMEY_SHS_LIFECYCLE_OWNER_URI,
		process.env.FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME,
		process.env.FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME,
		process.env.FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID,
		process.env.FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID,
		process.env.FB_HOMEY_SHS_WRITE_DEVICE_ID,
		process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID,
		configuredWriteStringValue(),
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
	[...text.matchAll(IP_ADDRESS_CANDIDATE_PATTERN)].some(
		(match) => match[0] !== '::' && findHomeyIpv6Range(match[0]) !== null,
	);

const containsHomeyTokenCandidate = (text: string): boolean =>
	[...text.matchAll(HOMEY_TOKEN_PATTERN)].some((match) => !PUBLIC_HOMEY_TOKEN_COLLISIONS.has(match[0].toLowerCase()));

const containsHomeyToken = (text: string, compiledSource: boolean): boolean => {
	if (!compiledSource) {
		return containsHomeyTokenCandidate(text);
	}

	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = [...text.matchAll(COMMENT_PATTERN)].some((match) => containsHomeyTokenCandidate(match[0]));
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
			const parent = node.parent;
			const isPublicSymbolDescription =
				COMPILED_SYMBOL_NAME_PATTERN.test(value) &&
				ts.isCallExpression(parent) &&
				ts.isIdentifier(parent.expression) &&
				parent.expression.text === 'Symbol' &&
				parent.arguments[0] === node;

			found = !isPublicSymbolDescription && containsHomeyTokenCandidate(value);
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

const compiledPropertyName = (name: ts.PropertyName): string | undefined => {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}

	if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
		return name.expression.text;
	}

	return undefined;
};

const compiledAssignedPropertyName = (expression: ts.Expression): string | undefined => {
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}

	if (ts.isPropertyAccessExpression(expression)) {
		return expression.name.text;
	}

	if (ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression)) {
		return COMPILED_SYMBOL_NAME_PATTERN.test(expression.argumentExpression.text)
			? undefined
			: expression.argumentExpression.text;
	}

	return undefined;
};

const containsUnsafeCompiledLiteral = (node: ts.Expression): boolean => {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text.length > 0 && node.text !== '[~3~]';
	}

	if (ts.isNumericLiteral(node)) {
		return node.text !== '0';
	}

	if (ts.isBigIntLiteral(node)) {
		return node.text !== '0n';
	}

	if (
		node.kind === ts.SyntaxKind.TrueKeyword ||
		node.kind === ts.SyntaxKind.FalseKeyword ||
		node.kind === ts.SyntaxKind.NullKeyword
	) {
		return false;
	}

	if (ts.isArrayLiteralExpression(node)) {
		return node.elements.some((element) => ts.isExpression(element) && containsUnsafeCompiledLiteral(element));
	}

	if (ts.isObjectLiteralExpression(node)) {
		return node.properties.some(
			(property) => ts.isPropertyAssignment(property) && containsUnsafeCompiledLiteral(property.initializer),
		);
	}

	if (ts.isBinaryExpression(node)) {
		return containsUnsafeCompiledLiteral(node.left) || containsUnsafeCompiledLiteral(node.right);
	}

	if (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isNonNullExpression(node) ||
		ts.isSatisfiesExpression(node)
	) {
		return containsUnsafeCompiledLiteral(node.expression);
	}

	if (ts.isConditionalExpression(node)) {
		return containsUnsafeCompiledLiteral(node.whenTrue) || containsUnsafeCompiledLiteral(node.whenFalse);
	}

	if (ts.isCallExpression(node)) {
		const receiver =
			ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression)
				? node.expression.expression
				: undefined;

		return (
			(receiver !== undefined && containsUnsafeCompiledLiteral(receiver)) ||
			node.arguments.some((argument) => containsUnsafeCompiledLiteral(argument))
		);
	}

	if (ts.isNewExpression(node)) {
		return node.arguments?.some((argument) => containsUnsafeCompiledLiteral(argument)) ?? false;
	}

	if (ts.isTemplateExpression(node)) {
		return (
			node.head.text.length > 0 ||
			node.templateSpans.some((span) => span.literal.text.length > 0 || containsUnsafeCompiledLiteral(span.expression))
		);
	}

	if (ts.isTaggedTemplateExpression(node)) {
		return containsUnsafeCompiledLiteral(node.template);
	}

	if (ts.isAwaitExpression(node)) {
		return containsUnsafeCompiledLiteral(node.expression);
	}

	if (ts.isPrefixUnaryExpression(node)) {
		return containsUnsafeCompiledLiteral(node.operand);
	}

	return false;
};

const isCompiledSecretName = (name: string | undefined): name is string =>
	name !== undefined && !PUBLIC_COMPILED_SECRET_NAMES.has(name) && isHomeySecretKey(name);

const isAssignmentOperatorKind = (kind: ts.SyntaxKind): boolean =>
	kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

const containsCompiledSecret = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			const name = compiledPropertyName(node.name);

			found = isCompiledSecretName(name) && containsUnsafeCompiledLiteral(node.initializer);
		} else if (ts.isPropertyDeclaration(node) && node.initializer !== undefined) {
			const name = compiledPropertyName(node.name);

			found = isCompiledSecretName(name) && containsUnsafeCompiledLiteral(node.initializer);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = isCompiledSecretName(node.name.text) && containsUnsafeCompiledLiteral(node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = isCompiledSecretName(node.name.text) && containsUnsafeCompiledLiteral(node.initializer);
		} else if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = isCompiledSecretName(node.name.text) && containsUnsafeCompiledLiteral(node.initializer);
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			const name = compiledAssignedPropertyName(node.left);

			found = isCompiledSecretName(name) && containsUnsafeCompiledLiteral(node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const compiledStaticString = (node: ts.Expression): string | undefined => {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}

	if (ts.isParenthesizedExpression(node)) {
		return compiledStaticString(node.expression);
	}

	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		const left = compiledStaticString(node.left);
		const right = compiledStaticString(node.right);

		return left === undefined || right === undefined ? undefined : left + right;
	}

	return undefined;
};

const containsCompiledPrivateUrl = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			found = containsStructuredUrl(node.text);
		} else if (ts.isTemplateExpression(node)) {
			found =
				containsStructuredUrl(node.head.text) ||
				node.templateSpans.some((span) => containsStructuredUrl(span.literal.text));
		} else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
			const staticString = compiledStaticString(node);

			found = staticString !== undefined && containsStructuredUrl(staticString);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsUnsafeSecretLeaf = (value: unknown): boolean => {
	if (value === null || value === 0 || value === '' || value === '[~3~]' || typeof value === 'boolean') {
		return false;
	}

	if (Array.isArray(value)) {
		return value.some((entry) => containsUnsafeSecretLeaf(entry));
	}

	if (typeof value === 'object') {
		return Object.values(value as JsonRecord).some((entry) => containsUnsafeSecretLeaf(entry));
	}

	return true;
};

const containsStructuredSecret = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredSecret(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(
		([key, child]) => (isHomeySecretKey(key) && containsUnsafeSecretLeaf(child)) || containsStructuredSecret(child),
	);
};

const containsStructuredAddress = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredAddress(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(([key, child]) => {
		const safeAddressValue = child === null || child === 0 || child === false || child === '[~0~]';

		return (isHomeyAddressKey(key) && !safeAddressValue) || containsStructuredAddress(child);
	});
};

const containsStructuredPersonalValue = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredPersonalValue(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(([key, child]) => {
		const safeRedaction = child === null || child === 0 || child === false || child === '[~2~]';
		const safePseudonym = isHomeyGeneratedPseudonym(child);
		const safeSyntheticValue = typeof child === 'string' && PUBLIC_SYNTHETIC_PERSONAL_VALUES.has(child);

		return (
			(isHomeyPersonalKey(key) && !safeRedaction && !safePseudonym && !safeSyntheticValue) ||
			containsStructuredPersonalValue(child)
		);
	});
};

const containsLooseSecretAssignment = (text: string): boolean =>
	[...text.matchAll(LOOSE_PROPERTY_PATTERN)].some((match) => {
		const key = match[1]?.trim();
		const rawValue = (match[3] ?? match[4])?.replace(/\s+#.*$/, '').trim();

		if (key === undefined || rawValue === undefined || !isHomeySecretKey(key)) {
			return false;
		}

		return !['', '0', '[~3~]', 'false', 'null', 'true', 'undefined'].includes(rawValue);
	});

const containsStructuredUrl = (value: unknown): boolean => {
	if (typeof value === 'string') {
		return !PUBLIC_ARTIFACT_URLS.has(value) && URL_PATTERN.test(value);
	}

	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredUrl(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.values(value as JsonRecord).some((entry) => containsStructuredUrl(entry));
};

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

	if (compiledSource && containsCompiledSecret(text)) {
		throw new Error(`${label} contains a compiled secret value`);
	}

	if (compiledSource && containsCompiledPrivateUrl(text)) {
		throw new Error(`${label} contains a private URL`);
	}

	for (const privateValue of configuredPrivateValues()) {
		if (text.toLocaleLowerCase().includes(privateValue.toLocaleLowerCase())) {
			throw new Error(`${label} contains a configured private Homey value`);
		}
	}
};

const assertFixtureTextSafe = (label: string, text: string, extension: string, checkPersonalValues = true): void => {
	assertTextSafe(label, text);

	const structuredValue =
		extension === '.json'
			? (JSON.parse(text) as unknown)
			: extension === '.yaml' || extension === '.yml'
				? (parseYaml(text) as unknown)
				: undefined;

	if (structuredValue === undefined ? URL_PATTERN.test(text) : containsStructuredUrl(structuredValue)) {
		throw new Error(`${label} contains a URL`);
	}

	const containsSecret =
		structuredValue === undefined ? containsLooseSecretAssignment(text) : containsStructuredSecret(structuredValue);

	if (containsSecret) {
		throw new Error(`${label} contains a structured secret value`);
	}

	if (structuredValue !== undefined && containsStructuredAddress(structuredValue)) {
		throw new Error(`${label} contains a structured address value`);
	}

	if (checkPersonalValues && structuredValue !== undefined && containsStructuredPersonalValue(structuredValue)) {
		throw new Error(`${label} contains a structured personal value`);
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

const visitPublishedValues = (
	label: string,
	value: unknown,
	path: readonly string[] = [],
	secretParameter = false,
): void => {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => visitPublishedValues(label, entry, [...path, index.toString()], secretParameter));

		return;
	}

	if (value === null || typeof value !== 'object') {
		return;
	}

	const record = value as JsonRecord;
	const nestedSecretParameter = secretParameter || (typeof record.name === 'string' && isHomeySecretKey(record.name));

	for (const [key, child] of Object.entries(record)) {
		const childPath = [...path, key];

		if (['default', 'enum', 'example', 'examples'].includes(key)) {
			if (containsStructuredSecret(child) || (nestedSecretParameter && containsUnsafeSecretLeaf(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes a secret value`);
			}

			if (containsStructuredUrl(child)) {
				throw new Error(`${label}.${childPath.join('.')} publishes a URL`);
			}
		}

		visitPublishedValues(label, child, childPath, nestedSecretParameter);
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
		visitPublishedValues('generated Homey OpenAPI schemas', homeySchemas);
		visitPublishedValues('generated Homey OpenAPI routes', homeyPaths);
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
			assertFixtureTextSafe(path.slice(REPOSITORY_ROOT.length + 1), readFileSync(path, 'utf8'), extname(path));
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
			const extension = extname(path);
			const label = path.slice(BACKEND_ROOT.length + 1);

			if (extension === '.json' || extension === '.yaml' || extension === '.yml') {
				assertFixtureTextSafe(label, text, extension, false);
			} else {
				assertTextSafe(label, text, path.endsWith('.js') || path.endsWith('.d.ts'));
			}
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
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { pinCode: 1234 },
			}),
		).toThrow('UnsafeHomeySchema.example publishes a secret value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: 'http://private-homey.local:4859',
			}),
		).toThrow('UnsafeHomeySchema.example publishes a URL');
		expect(() =>
			visitPublishedValues('UnsafeHomeyOperation', {
				parameters: [{ name: 'apiKey', schema: { example: 'opaque-secret' } }],
			}),
		).toThrow('UnsafeHomeyOperation.parameters.0.schema.example publishes a secret value');
		expect(() => assertTextSafe('unsafe fixture', '{"api_key":"must-not-be-reported"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"cookie":"must-not-be-reported"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"pinCode":1234}', '.json')).toThrow(
			'unsafe fixture contains a structured secret value',
		);
		expect(() => assertFixtureTextSafe('safe fixture', '{"pinCode":0}', '.json')).not.toThrow();
		expect(() => assertFixtureTextSafe('safe fixture', '{"hostname":"[~0~]"}', '.json')).not.toThrow();
		expect(() => assertFixtureTextSafe('safe fixture', '{"name":"device-label-000001"}', '.json')).not.toThrow();
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"hostname":"family-homey.local"}', '.json')).toThrow(
			'unsafe fixture contains a structured address value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"name":"Alice Bedroom"}', '.json')).toThrow(
			'unsafe fixture contains a structured personal value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', 'api_key: opaque-secret-value', '.yaml')).toThrow(
			'unsafe fixture contains a structured secret value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', 'config: { api_key: opaque-secret-value }', '.yaml')).toThrow(
			'unsafe fixture contains a structured secret value',
		);
		expect(() =>
			assertFixtureTextSafe('unsafe fixture', "Captured payload: { api_key: 'opaque-secret' }", '.md'),
		).toThrow('unsafe fixture contains a structured secret value');
		expect(() => assertFixtureTextSafe('unsafe fixture', 'API key: opaque-secret-value', '.md')).toThrow(
			'unsafe fixture contains a structured secret value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', 'endpoint: http://private-homey.local:4859', '.yaml')).toThrow(
			'unsafe fixture contains a URL',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"api_key":"[~3~]unredacted-password"}')).toThrow(
			'unsafe fixture contains a serialized secret value',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"value":"homey_abcdefghijklmnop"}')).toThrow(
			'unsafe fixture contains a Homey personal access token',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"value":"homey-abcdefghijklmnop"}')).toThrow(
			'unsafe fixture contains a Homey personal access token',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"value":"prefix_homey_abcdefghijklmnop"}')).toThrow(
			'unsafe fixture contains a Homey personal access token',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', 'throw new Error("request failed for homey_abcdefghijklmnop")', true),
		).toThrow('unsafe compiled module contains a Homey personal access token');
		expect(() => assertTextSafe('unsafe compiled module', 'const leaked = "HOMEY_ABCDEFGHIJKLMNOP";', true)).toThrow(
			'unsafe compiled module contains a Homey personal access token',
		);
		expect(() =>
			assertTextSafe('safe compiled module', 'const homey_local_connector_factory_1 = {};', true),
		).not.toThrow();
		expect(() =>
			assertTextSafe('unsafe compiled module', "const config = { api_key: 'opaque-secret' };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() => assertTextSafe('unsafe compiled module', "config.api_key = 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "config.apiKey ??= 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "config['accessToken'] = 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "const api_key = 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "api_key = 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', "const credentials = { value: 'opaque-secret' };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function connect(apiKey = 'opaque-secret') {}", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const apiKey = process.env.API_KEY ?? 'opaque-secret';", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() => assertTextSafe('unsafe compiled module', "const apiKey = String('opaque-secret');", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "const apiKey = 'opaque-secret'.trim();", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', "const endpoint = 'http://private-homey.local:4859';", true),
		).toThrow('unsafe compiled module contains a private URL');
		expect(() =>
			assertTextSafe('unsafe compiled module', 'const endpoint = `http://private-homey.local:${port}`;', true),
		).toThrow('unsafe compiled module contains a private URL');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const endpoint = 'http://' + 'private-homey.local:4859';", true),
		).toThrow('unsafe compiled module contains a private URL');
		expect(() => assertTextSafe('unsafe fixture', '{"address":"192.168.1.23"}')).toThrow(
			'unsafe fixture contains an IPv4 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"169.254.1.20"}')).toThrow(
			'unsafe fixture contains an IPv4 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"prefix192.168.1.23"}')).toThrow(
			'unsafe fixture contains an IPv4 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"fe80::1%en0"}')).toThrow(
			'unsafe fixture contains an IPv6 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"host-fe80::1"}')).toThrow(
			'unsafe fixture contains an IPv6 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"address":"prefix2001:db8::1"}')).toThrow(
			'unsafe fixture contains an IPv6 address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"mac":"aabb.ccdd.eeff"}')).toThrow(
			'unsafe fixture contains a MAC address',
		);
		expect(() => assertTextSafe('unsafe fixture', '{"mac":"aabbccddeeff"}')).toThrow(
			'unsafe fixture contains a MAC address',
		);
		const previousPrivateTerms = process.env.FB_HOMEY_SHS_PRIVATE_TERMS;
		const previousReplacementApiKey = process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY;
		const previousDeviceOnlyApiKey = process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY;
		const previousExpectedHost = process.env.FB_HOMEY_SHS_EXPECTED_HOST;
		const previousLifecycleDeviceMarker = process.env.FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER;
		const previousWriteDeviceId = process.env.FB_HOMEY_SHS_WRITE_DEVICE_ID;
		const previousWriteCapabilityId = process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID;
		const previousWriteValue = process.env.FB_HOMEY_SHS_WRITE_VALUE;

		process.env.FB_HOMEY_SHS_PRIVATE_TERMS = 'Ada';
		process.env.FB_HOMEY_SHS_REPLACEMENT_API_KEY = 'opaque-replacement-value';
		process.env.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY = 'opaque-device-value';
		process.env.FB_HOMEY_SHS_EXPECTED_HOST = 'homey.local';
		process.env.FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER = 'private-lifecycle-marker';
		process.env.FB_HOMEY_SHS_WRITE_DEVICE_ID = 'private-write-device';
		process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID = 'private-write-capability';
		process.env.FB_HOMEY_SHS_WRITE_VALUE = '"private-write-value"';

		try {
			expect(() => assertTextSafe('safe fixture', '{"url":"http://homey.local:4859"}')).not.toThrow();
			process.env.FB_HOMEY_SHS_EXPECTED_HOST = 'private-homey.local.';
			expect(() => assertTextSafe('unsafe fixture', '{"host":"private-homey.local"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"name":"Ada"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"value":"opaque-replacement-value"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"value":"opaque-device-value"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			expect(() => assertTextSafe('unsafe fixture', '{"value":"private-lifecycle-marker"}')).toThrow(
				'unsafe fixture contains a configured private Homey value',
			);
			for (const privateWriteValue of ['private-write-device', 'private-write-capability', 'private-write-value']) {
				expect(() => assertTextSafe('unsafe fixture', `{"value":"${privateWriteValue}"}`)).toThrow(
					'unsafe fixture contains a configured private Homey value',
				);
			}
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

			if (previousExpectedHost === undefined) {
				delete process.env.FB_HOMEY_SHS_EXPECTED_HOST;
			} else {
				process.env.FB_HOMEY_SHS_EXPECTED_HOST = previousExpectedHost;
			}

			if (previousLifecycleDeviceMarker === undefined) {
				delete process.env.FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER;
			} else {
				process.env.FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER = previousLifecycleDeviceMarker;
			}

			if (previousWriteDeviceId === undefined) {
				delete process.env.FB_HOMEY_SHS_WRITE_DEVICE_ID;
			} else {
				process.env.FB_HOMEY_SHS_WRITE_DEVICE_ID = previousWriteDeviceId;
			}

			if (previousWriteCapabilityId === undefined) {
				delete process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID;
			} else {
				process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID = previousWriteCapabilityId;
			}

			if (previousWriteValue === undefined) {
				delete process.env.FB_HOMEY_SHS_WRITE_VALUE;
			} else {
				process.env.FB_HOMEY_SHS_WRITE_VALUE = previousWriteValue;
			}
		}
	});
});
