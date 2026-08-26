import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import {
	findHomeyIpv6Range,
	isHomeyAddressKey,
	isHomeyEndpointKey,
	isHomeyGeneratedPseudonym,
	isHomeyIconKey,
	isHomeyIdentifierKey,
	isHomeyIdentifierMapKey,
	isHomeyIsoTimestamp,
	isHomeyPersonalKey,
	isHomeyReferenceArrayKey,
	isHomeyReferenceKey,
	isHomeySanitizedCapabilityIdentifier,
	isHomeySecretKey,
	isHomeyTimestampKey,
	isHomeyUuid,
	isPublicHomeyCapabilityBase,
	isPublicHomeyEnumState,
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
const PUBLIC_SYNTHETIC_PERSONAL_VALUES = new Set([
	'Locked',
	'Synthetic lock contract',
	'Synthetic mode A',
	'Synthetic mode B',
	'Synthetic mode C',
]);
const PUBLIC_SYNTHETIC_IDENTIFIER_VALUES = new Set([
	'123e4567-e89b-12d3-a456-426614174000',
	'550e8400-e29b-41d4-a716-446655440000',
	'b27b7c58-76f6-407a-bc78-4068e4cfd082',
	'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	'synthetic-lock-device',
	'synthetic_mode',
]);
const PUBLIC_COMPILED_IDENTIFIER_LABELS = new Set(['event device id', 'event zone id']);
const PUBLIC_COMPILED_PERSONAL_VALUES = new Set(['Homey', 'class', 'device name', 'mode', 'zone name']);
const PUBLIC_COMPILED_PERSONAL_IDENTIFIER_PATTERN =
	/^(?:DevicesHomey[A-Za-z0-9]*|[A-Z][A-Za-z0-9]*Error|is[A-Z][A-Za-z0-9]*|[a-z0-9]+(?:[_-][a-z0-9]+)+)$/;
const REDACTION_SENTINEL_PATTERN = /^\[~[0-7]~\]$/;
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
const FIXTURE_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const PUBLIC_FIXTURE_DATES = new Set(['2026-08-13']);
const PUBLIC_OPENAPI_TIMESTAMPS = new Set(['2025-01-18T12:00:00Z', '2025-01-25T12:00:00Z']);
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

const configuredPrivateWriteStringValue = (): string | undefined => {
	const value = configuredWriteStringValue();
	const capabilityId = process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID?.trim();

	return value !== undefined && capabilityId !== undefined && isPublicHomeyEnumState(capabilityId, value)
		? undefined
		: value;
};

const configuredExpectedHost = (): string | undefined => {
	const value = process.env.FB_HOMEY_SHS_EXPECTED_HOST?.trim();
	const normalizedValue = value?.toLowerCase().replace(/\.$/, '');

	return normalizedValue === undefined || PUBLIC_HOMEY_HOSTS.has(normalizedValue) ? undefined : normalizedValue;
};

const configuredWriteCapabilityId = (): string | undefined => {
	const value = process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID?.trim();

	return value === undefined || isPublicHomeyCapabilityBase(value) ? undefined : value;
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
		configuredWriteCapabilityId(),
		configuredPrivateWriteStringValue(),
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

const compiledBindingValues = (binding: ts.BindingElement): readonly ts.Expression[] => {
	const values: ts.Expression[] = binding.initializer === undefined ? [] : [binding.initializer];
	let current: ts.Node = binding.parent;

	while (ts.isObjectBindingPattern(current) || ts.isArrayBindingPattern(current) || ts.isBindingElement(current)) {
		current = current.parent;
	}

	if (ts.isVariableDeclaration(current) && current.initializer !== undefined) {
		values.push(current.initializer);
	}

	return values;
};

const SAFE_COMPILED_SECRET_STRINGS = new Set(['', '[~3~]']);
const SAFE_COMPILED_ADDRESS_STRINGS = new Set(['[~0~]']);
type SafeCompiledString = ReadonlySet<string> | ((value: string) => boolean);

const isSafeCompiledString = (value: string, safeStrings: SafeCompiledString): boolean =>
	typeof safeStrings === 'function' ? safeStrings(value) : safeStrings.has(value);

const containsUnsafeCompiledLiteral = (
	node: ts.Expression,
	safeStrings: SafeCompiledString = SAFE_COMPILED_SECRET_STRINGS,
): boolean => {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return !isSafeCompiledString(node.text, safeStrings);
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
		return node.elements.some((element) =>
			ts.isSpreadElement(element)
				? containsUnsafeCompiledLiteral(element.expression, safeStrings)
				: ts.isExpression(element) && containsUnsafeCompiledLiteral(element, safeStrings),
		);
	}

	if (ts.isObjectLiteralExpression(node)) {
		return node.properties.some(
			(property) =>
				(ts.isPropertyAssignment(property) && containsUnsafeCompiledLiteral(property.initializer, safeStrings)) ||
				(ts.isSpreadAssignment(property) && containsUnsafeCompiledLiteral(property.expression, safeStrings)) ||
				(ts.isShorthandPropertyAssignment(property) && containsUnsafeCompiledValue(property.name, safeStrings)) ||
				((ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)) &&
					property.body !== undefined &&
					containsUnsafeCompiledBodyLiteral(property.body, safeStrings)) ||
				(ts.isSetAccessorDeclaration(property) &&
					(property.parameters.some(
						(parameter) =>
							parameter.initializer !== undefined && containsUnsafeCompiledValue(parameter.initializer, safeStrings),
					) ||
						(property.body !== undefined && containsUnsafeCompiledBodyLiteral(property.body, safeStrings)))),
		);
	}

	if (ts.isBinaryExpression(node)) {
		return (
			containsUnsafeCompiledLiteral(node.left, safeStrings) || containsUnsafeCompiledLiteral(node.right, safeStrings)
		);
	}

	if (
		ts.isParenthesizedExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isTypeAssertionExpression(node) ||
		ts.isNonNullExpression(node) ||
		ts.isSatisfiesExpression(node)
	) {
		return containsUnsafeCompiledLiteral(node.expression, safeStrings);
	}

	if (ts.isConditionalExpression(node)) {
		return (
			containsUnsafeCompiledLiteral(node.whenTrue, safeStrings) ||
			containsUnsafeCompiledLiteral(node.whenFalse, safeStrings)
		);
	}

	if (ts.isCallExpression(node)) {
		const receiver =
			ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression)
				? node.expression.expression
				: undefined;

		return (
			containsUnsafeCompiledLiteral(node.expression, safeStrings) ||
			(receiver !== undefined && containsUnsafeCompiledLiteral(receiver, safeStrings)) ||
			node.arguments.some((argument) => containsUnsafeCompiledLiteral(argument, safeStrings))
		);
	}

	if (ts.isNewExpression(node)) {
		return node.arguments?.some((argument) => containsUnsafeCompiledLiteral(argument, safeStrings)) ?? false;
	}

	if (ts.isTemplateExpression(node)) {
		return (
			node.head.text.length > 0 ||
			node.templateSpans.some(
				(span) => span.literal.text.length > 0 || containsUnsafeCompiledLiteral(span.expression, safeStrings),
			)
		);
	}

	if (ts.isTaggedTemplateExpression(node)) {
		return containsUnsafeCompiledLiteral(node.template, safeStrings);
	}

	if (ts.isAwaitExpression(node)) {
		return containsUnsafeCompiledLiteral(node.expression, safeStrings);
	}

	if (ts.isPrefixUnaryExpression(node)) {
		return containsUnsafeCompiledLiteral(node.operand, safeStrings);
	}

	if (ts.isArrowFunction(node)) {
		return ts.isBlock(node.body)
			? containsUnsafeCompiledBodyLiteral(node.body, safeStrings)
			: containsUnsafeCompiledLiteral(node.body, safeStrings);
	}

	if (ts.isFunctionExpression(node)) {
		return containsUnsafeCompiledBodyLiteral(node.body, safeStrings);
	}

	return false;
};

interface CompiledBinding {
	readonly callable?: ts.FunctionDeclaration;
	readonly declaration: ts.Declaration;
	readonly initializer?: ts.Expression;
	readonly scope: ts.Node;
}

const COMPILED_BINDING_CACHE = new WeakMap<ts.SourceFile, ReadonlyMap<string, readonly CompiledBinding[]>>();

const compiledBindingScope = (node: ts.Node): ts.Node => {
	let current: ts.Node | undefined = node.parent;

	while (current !== undefined) {
		if (
			ts.isSourceFile(current) ||
			ts.isBlock(current) ||
			ts.isModuleBlock(current) ||
			ts.isCaseBlock(current) ||
			ts.isForStatement(current) ||
			ts.isForInStatement(current) ||
			ts.isForOfStatement(current) ||
			ts.isFunctionLike(current)
		) {
			return current;
		}

		current = current.parent;
	}

	return node.getSourceFile();
};

const compiledBindings = (sourceFile: ts.SourceFile): ReadonlyMap<string, readonly CompiledBinding[]> => {
	const cached = COMPILED_BINDING_CACHE.get(sourceFile);

	if (cached !== undefined) {
		return cached;
	}

	const bindings = new Map<string, CompiledBinding[]>();
	const addBinding = (name: string, binding: CompiledBinding): void => {
		bindings.set(name, [...(bindings.get(name) ?? []), binding]);
	};
	const visit = (node: ts.Node): void => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			const constantInitializer =
				node.initializer !== undefined &&
				ts.isVariableDeclarationList(node.parent) &&
				(node.parent.flags & ts.NodeFlags.Const) !== 0
					? node.initializer
					: undefined;

			addBinding(node.name.text, {
				declaration: node,
				initializer: constantInitializer,
				scope: compiledBindingScope(node),
			});
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			addBinding(node.name.text, { declaration: node, scope: compiledBindingScope(node) });
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
			addBinding(node.name.text, { callable: node, declaration: node, scope: compiledBindingScope(node) });
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	COMPILED_BINDING_CACHE.set(sourceFile, bindings);

	return bindings;
};

const isNodeWithin = (node: ts.Node, ancestor: ts.Node): boolean => {
	let current: ts.Node | undefined = node;

	while (current !== undefined) {
		if (current === ancestor) {
			return true;
		}

		current = current.parent;
	}

	return false;
};

const compiledScopeDepth = (scope: ts.Node): number => {
	let depth = 0;
	let current: ts.Node | undefined = scope;

	while (current !== undefined) {
		depth += 1;
		current = current.parent;
	}

	return depth;
};

const resolveCompiledBinding = (identifier: ts.Identifier): CompiledBinding | undefined => {
	const sourceFile = identifier.getSourceFile();
	const usePosition = identifier.getStart(sourceFile);
	const visibleBindings = (compiledBindings(sourceFile).get(identifier.text) ?? [])
		.filter(
			(binding) =>
				isNodeWithin(identifier, binding.scope) &&
				(ts.isParameter(binding.declaration) || binding.declaration.getStart(sourceFile) < usePosition),
		)
		.sort((left, right) => {
			const depthDifference = compiledScopeDepth(right.scope) - compiledScopeDepth(left.scope);

			return depthDifference !== 0
				? depthDifference
				: right.declaration.getStart(sourceFile) - left.declaration.getStart(sourceFile);
		});

	return visibleBindings[0];
};

const resolveCompiledAlias = (identifier: ts.Identifier): ts.Expression | undefined =>
	resolveCompiledBinding(identifier)?.initializer;

const containsUnsafeCompiledAlias = (
	node: ts.Expression,
	safeStrings: SafeCompiledString,
	resolvingAliases = new Set<string>(),
): boolean => {
	const resolveArrayElements = (
		expression: ts.Expression,
		resolving: Set<string>,
	): readonly ts.Expression[] | undefined => {
		if (ts.isIdentifier(expression)) {
			const initializer = resolveCompiledAlias(expression);

			return initializer === undefined || resolving.has(expression.text)
				? undefined
				: resolveArrayElements(initializer, new Set(resolving).add(expression.text));
		}

		if (
			ts.isParenthesizedExpression(expression) ||
			ts.isAsExpression(expression) ||
			ts.isTypeAssertionExpression(expression) ||
			ts.isNonNullExpression(expression) ||
			ts.isSatisfiesExpression(expression)
		) {
			return resolveArrayElements(expression.expression, resolving);
		}

		if (!ts.isArrayLiteralExpression(expression)) {
			return undefined;
		}

		const elements: ts.Expression[] = [];

		for (const element of expression.elements) {
			if (ts.isSpreadElement(element)) {
				const spreadElements = resolveArrayElements(element.expression, resolving);

				if (spreadElements === undefined) {
					return undefined;
				}

				elements.push(...spreadElements);
			} else if (ts.isExpression(element)) {
				elements.push(element);
			} else {
				return undefined;
			}
		}

		return elements;
	};
	const inspect = (expression: ts.Expression, resolving: Set<string>): boolean => {
		if (ts.isIdentifier(expression)) {
			const initializer = resolveCompiledAlias(expression);

			if (initializer === undefined || resolving.has(expression.text)) {
				return false;
			}

			const nestedResolving = new Set(resolving).add(expression.text);

			return containsUnsafeCompiledLiteral(initializer, safeStrings) || inspect(initializer, nestedResolving);
		}

		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			const propertyName = ts.isPropertyAccessExpression(expression)
				? expression.name.text
				: expression.argumentExpression !== undefined &&
					  (ts.isStringLiteral(expression.argumentExpression) || ts.isNumericLiteral(expression.argumentExpression))
					? expression.argumentExpression.text
					: undefined;
			const inspectProperty = (receiver: ts.Expression, nestedResolving: Set<string>): boolean => {
				if (propertyName === undefined) {
					return false;
				}

				if (ts.isIdentifier(receiver)) {
					const initializer = resolveCompiledAlias(receiver);

					if (initializer === undefined || nestedResolving.has(receiver.text)) {
						return false;
					}

					return inspectProperty(initializer, new Set(nestedResolving).add(receiver.text));
				}

				if (
					ts.isParenthesizedExpression(receiver) ||
					ts.isAsExpression(receiver) ||
					ts.isTypeAssertionExpression(receiver) ||
					ts.isNonNullExpression(receiver) ||
					ts.isSatisfiesExpression(receiver)
				) {
					return inspectProperty(receiver.expression, nestedResolving);
				}

				if (ts.isObjectLiteralExpression(receiver)) {
					return receiver.properties.some((property) => {
						if (ts.isPropertyAssignment(property) && compiledPropertyName(property.name) === propertyName) {
							return (
								containsUnsafeCompiledLiteral(property.initializer, safeStrings) ||
								inspect(property.initializer, nestedResolving)
							);
						}

						if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
							return inspect(property.name, nestedResolving);
						}

						return ts.isSpreadAssignment(property) && inspectProperty(property.expression, nestedResolving);
					});
				}

				if (/^\d+$/.test(propertyName)) {
					const element = resolveArrayElements(receiver, nestedResolving)?.[Number(propertyName)];

					if (element === undefined) {
						return false;
					}

					return ts.isSpreadElement(element)
						? inspect(element.expression, nestedResolving)
						: ts.isExpression(element) &&
								(containsUnsafeCompiledLiteral(element, safeStrings) || inspect(element, nestedResolving));
				}

				return false;
			};

			return inspectProperty(expression.expression, resolving);
		}

		if (ts.isArrayLiteralExpression(expression)) {
			return expression.elements.some((element) =>
				ts.isSpreadElement(element)
					? inspect(element.expression, resolving)
					: ts.isExpression(element) && inspect(element, resolving),
			);
		}

		if (ts.isObjectLiteralExpression(expression)) {
			return expression.properties.some(
				(property) =>
					(ts.isPropertyAssignment(property) && inspect(property.initializer, resolving)) ||
					(ts.isSpreadAssignment(property) && inspect(property.expression, resolving)),
			);
		}

		if (ts.isBinaryExpression(expression)) {
			return inspect(expression.left, resolving) || inspect(expression.right, resolving);
		}

		if (
			ts.isParenthesizedExpression(expression) ||
			ts.isAsExpression(expression) ||
			ts.isTypeAssertionExpression(expression) ||
			ts.isNonNullExpression(expression) ||
			ts.isSatisfiesExpression(expression) ||
			ts.isAwaitExpression(expression)
		) {
			return inspect(expression.expression, resolving);
		}

		if (ts.isConditionalExpression(expression)) {
			return inspect(expression.whenTrue, resolving) || inspect(expression.whenFalse, resolving);
		}

		if (ts.isCallExpression(expression)) {
			return (
				inspectCallable(expression.expression, resolving) ||
				expression.arguments.some((argument) => inspect(argument, resolving))
			);
		}

		if (ts.isNewExpression(expression)) {
			return expression.arguments?.some((argument) => inspect(argument, resolving)) ?? false;
		}

		if (ts.isTemplateExpression(expression)) {
			return expression.templateSpans.some((span) => inspect(span.expression, resolving));
		}

		if (ts.isTaggedTemplateExpression(expression)) {
			return inspect(expression.template, resolving);
		}

		if (ts.isPrefixUnaryExpression(expression)) {
			return inspect(expression.operand, resolving);
		}

		return false;
	};
	const inspectCallableBody = (body: ts.Block, resolving: Set<string>): boolean => {
		let found = false;
		const visitReturn = (child: ts.Node): void => {
			if (found) {
				return;
			}

			if (ts.isReturnStatement(child) && child.expression !== undefined) {
				found = containsUnsafeCompiledLiteral(child.expression, safeStrings) || inspect(child.expression, resolving);
			}

			if (!found) {
				ts.forEachChild(child, visitReturn);
			}
		};

		visitReturn(body);

		return found;
	};
	const inspectCallable = (callee: ts.Expression, resolving: Set<string>): boolean => {
		if (ts.isIdentifier(callee)) {
			const binding = resolveCompiledBinding(callee);

			if (binding === undefined || resolving.has(callee.text)) {
				return false;
			}

			const nestedResolving = new Set(resolving).add(callee.text);

			return binding.initializer !== undefined
				? inspectCallable(binding.initializer, nestedResolving)
				: binding.callable?.body !== undefined && inspectCallableBody(binding.callable.body, nestedResolving);
		}

		if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
			const propertyName = ts.isPropertyAccessExpression(callee)
				? callee.name.text
				: callee.argumentExpression !== undefined &&
					  (ts.isStringLiteral(callee.argumentExpression) || ts.isNumericLiteral(callee.argumentExpression))
					? callee.argumentExpression.text
					: undefined;
			const inspectCallableProperty = (receiver: ts.Expression, nestedResolving: Set<string>): boolean => {
				if (propertyName === undefined) {
					return false;
				}

				if (ts.isIdentifier(receiver)) {
					const initializer = resolveCompiledAlias(receiver);

					if (initializer === undefined || nestedResolving.has(receiver.text)) {
						return false;
					}

					return inspectCallableProperty(initializer, new Set(nestedResolving).add(receiver.text));
				}

				if (
					ts.isParenthesizedExpression(receiver) ||
					ts.isAsExpression(receiver) ||
					ts.isTypeAssertionExpression(receiver) ||
					ts.isNonNullExpression(receiver) ||
					ts.isSatisfiesExpression(receiver)
				) {
					return inspectCallableProperty(receiver.expression, nestedResolving);
				}

				if (ts.isObjectLiteralExpression(receiver)) {
					return receiver.properties.some((property) => {
						if (ts.isPropertyAssignment(property) && compiledPropertyName(property.name) === propertyName) {
							return inspectCallable(property.initializer, nestedResolving);
						}

						if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
							return inspectCallable(property.name, nestedResolving);
						}

						return ts.isSpreadAssignment(property) && inspectCallableProperty(property.expression, nestedResolving);
					});
				}

				if (/^\d+$/.test(propertyName)) {
					const element = resolveArrayElements(receiver, nestedResolving)?.[Number(propertyName)];

					return element !== undefined && ts.isExpression(element) && inspectCallable(element, nestedResolving);
				}

				return false;
			};

			return inspectCallableProperty(callee.expression, resolving);
		}

		if (
			ts.isParenthesizedExpression(callee) ||
			ts.isAsExpression(callee) ||
			ts.isTypeAssertionExpression(callee) ||
			ts.isNonNullExpression(callee) ||
			ts.isSatisfiesExpression(callee)
		) {
			return inspectCallable(callee.expression, resolving);
		}

		if (ts.isArrowFunction(callee) && !ts.isBlock(callee.body)) {
			return containsUnsafeCompiledLiteral(callee.body, safeStrings) || inspect(callee.body, resolving);
		}

		if (ts.isArrowFunction(callee)) {
			return ts.isBlock(callee.body) && inspectCallableBody(callee.body, resolving);
		}

		if (ts.isFunctionExpression(callee)) {
			return inspectCallableBody(callee.body, resolving);
		}

		return false;
	};

	return inspect(node, resolvingAliases);
};

const containsUnsafeCompiledValue = (
	node: ts.Expression,
	safeStrings: SafeCompiledString = SAFE_COMPILED_SECRET_STRINGS,
): boolean => containsUnsafeCompiledLiteral(node, safeStrings) || containsUnsafeCompiledAlias(node, safeStrings);

const isCompiledSecretName = (name: string | undefined): name is string => name !== undefined && isHomeySecretKey(name);

const isPublicSecretFieldsDescriptor = (node: ts.Expression): boolean => {
	if (!ts.isArrayLiteralExpression(node) || node.elements.length !== 1) {
		return false;
	}

	const [descriptor] = node.elements;

	if (!ts.isObjectLiteralExpression(descriptor) || descriptor.properties.length !== 3) {
		return false;
	}

	const properties = new Map(
		descriptor.properties.flatMap((property) => {
			if (!ts.isPropertyAssignment(property)) {
				return [];
			}

			const name = compiledPropertyName(property.name);

			return name === undefined ? [] : [[name, property.initializer] as const];
		}),
	);
	const path = properties.get('path');
	const configuredPath = properties.get('configuredPath');
	const inputPaths = properties.get('inputPaths');

	return (
		properties.size === 3 &&
		path !== undefined &&
		ts.isStringLiteral(path) &&
		path.text === 'api_key' &&
		configuredPath !== undefined &&
		ts.isStringLiteral(configuredPath) &&
		configuredPath.text === 'api_key_configured' &&
		inputPaths !== undefined &&
		ts.isArrayLiteralExpression(inputPaths) &&
		inputPaths.elements.length === 1 &&
		ts.isStringLiteral(inputPaths.elements[0]) &&
		inputPaths.elements[0].text === 'apiKey'
	);
};

const containsUnsafeCompiledType = (
	type: ts.TypeNode,
	safeStrings: SafeCompiledString = SAFE_COMPILED_SECRET_STRINGS,
): boolean => {
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isLiteralTypeNode(node) && ts.isExpression(node.literal)) {
			found = containsUnsafeCompiledLiteral(node.literal, safeStrings);
		}

		ts.forEachChild(node, visit);
	};

	visit(type);

	return found;
};

const isAssignmentOperatorKind = (kind: ts.SyntaxKind): boolean =>
	kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

const containsUnsafeCompiledBodyLiteral = (
	body: ts.Block,
	safeStrings: SafeCompiledString = SAFE_COMPILED_SECRET_STRINGS,
): boolean => {
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isExpression(node) && containsUnsafeCompiledValue(node, safeStrings)) {
			found = true;

			return;
		}

		ts.forEachChild(node, visit);
	};

	visit(body);

	return found;
};

const containsCompiledSecret = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			const name = compiledPropertyName(node.name);

			found =
				isCompiledSecretName(name) &&
				!(name === 'secretFields' && isPublicSecretFieldsDescriptor(node.initializer)) &&
				containsUnsafeCompiledValue(node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				isCompiledSecretName(name) &&
				((node.initializer !== undefined && containsUnsafeCompiledValue(node.initializer)) ||
					(node.type !== undefined && containsUnsafeCompiledType(node.type)));
		} else if (ts.isPropertySignature(node)) {
			const name = compiledPropertyName(node.name);

			found = isCompiledSecretName(name) && node.type !== undefined && containsUnsafeCompiledType(node.type);
		} else if (ts.isSetAccessorDeclaration(node) && isCompiledSecretName(compiledPropertyName(node.name))) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined && containsUnsafeCompiledValue(parameter.initializer)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body));
		} else if (
			(ts.isGetAccessorDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) &&
			isCompiledSecretName(compiledPropertyName(node.name))
		) {
			found =
				('body' in node && node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body)) ||
				(node.type !== undefined && containsUnsafeCompiledType(node.type));
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isCompiledSecretName(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined && containsUnsafeCompiledValue(parameter.initializer)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body)) ||
				(node.type !== undefined && containsUnsafeCompiledType(node.type));
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found =
				isCompiledSecretName(node.name.text) &&
				!(node.name.text === 'secretFields' && isPublicSecretFieldsDescriptor(node.initializer)) &&
				containsUnsafeCompiledValue(node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				isCompiledSecretName(node.name.text) &&
				((node.initializer !== undefined && containsUnsafeCompiledValue(node.initializer)) ||
					(node.type !== undefined && containsUnsafeCompiledType(node.type)));
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found =
				names.some((name) => isCompiledSecretName(name)) &&
				compiledBindingValues(node).some((value) => containsUnsafeCompiledValue(value));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			const name = compiledAssignedPropertyName(node.left);

			found = isCompiledSecretName(name) && containsUnsafeCompiledValue(node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsCompiledAddress = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const unsafeAddress = (name: string | undefined, expression: ts.Expression): boolean =>
		name !== undefined &&
		isHomeyAddressKey(name) &&
		containsUnsafeCompiledValue(expression, SAFE_COMPILED_ADDRESS_STRINGS);
	const unsafeAddressType = (name: string | undefined, type: ts.TypeNode | undefined): boolean =>
		name !== undefined &&
		isHomeyAddressKey(name) &&
		type !== undefined &&
		containsUnsafeCompiledType(type, SAFE_COMPILED_ADDRESS_STRINGS);
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			found = unsafeAddress(compiledPropertyName(node.name), node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				(node.initializer !== undefined && unsafeAddress(name, node.initializer)) || unsafeAddressType(name, node.type);
		} else if (ts.isPropertySignature(node)) {
			found = unsafeAddressType(compiledPropertyName(node.name), node.type);
		} else if (ts.isSetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				name !== undefined &&
				isHomeyAddressKey(name) &&
				(node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, SAFE_COMPILED_ADDRESS_STRINGS)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, SAFE_COMPILED_ADDRESS_STRINGS)),
				) ||
					(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, SAFE_COMPILED_ADDRESS_STRINGS)));
		} else if (ts.isGetAccessorDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			const name = compiledPropertyName(node.name);

			found =
				('body' in node &&
					node.body !== undefined &&
					name !== undefined &&
					isHomeyAddressKey(name) &&
					containsUnsafeCompiledBodyLiteral(node.body, SAFE_COMPILED_ADDRESS_STRINGS)) ||
				unsafeAddressType(name, node.type);
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isHomeyAddressKey(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, SAFE_COMPILED_ADDRESS_STRINGS)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, SAFE_COMPILED_ADDRESS_STRINGS)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, SAFE_COMPILED_ADDRESS_STRINGS)) ||
				unsafeAddressType(node.name.text, node.type);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = unsafeAddress(node.name.text, node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				(node.initializer !== undefined && unsafeAddress(node.name.text, node.initializer)) ||
				unsafeAddressType(node.name.text, node.type);
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found = compiledBindingValues(node).some((value) => names.some((name) => unsafeAddress(name, value)));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			found = unsafeAddress(compiledAssignedPropertyName(node.left), node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsCompiledIdentifier = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const isPrivateIdentifierName = (name: string | undefined): name is string =>
		name !== undefined &&
		(isHomeyReferenceKey(name) || isHomeyIdentifierKey(name)) &&
		!['DEVICES_HOMEY_CONNECTOR_SERVICE_ID', 'baseId', 'id', 'operationId', 'serviceId'].includes(name) &&
		!/^capabilit(?:y|ies)(?:Id|Ids|Identifier|Identifiers)$/i.test(name);
	const isSafeCompiledIdentifierValue = (value: string): boolean =>
		isSafeIdentifierValue(value) || PUBLIC_COMPILED_IDENTIFIER_LABELS.has(value);
	const unsafeIdentifier = (name: string | undefined, expression: ts.Expression): boolean =>
		isPrivateIdentifierName(name) && containsUnsafeCompiledValue(expression, isSafeCompiledIdentifierValue);
	const unsafeIdentifierType = (name: string | undefined, type: ts.TypeNode | undefined): boolean =>
		isPrivateIdentifierName(name) &&
		type !== undefined &&
		containsUnsafeCompiledType(type, isSafeCompiledIdentifierValue);
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			found = unsafeIdentifier(compiledPropertyName(node.name), node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				(node.initializer !== undefined && unsafeIdentifier(name, node.initializer)) ||
				unsafeIdentifierType(name, node.type);
		} else if (ts.isPropertySignature(node)) {
			found = unsafeIdentifierType(compiledPropertyName(node.name), node.type);
		} else if (ts.isSetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				isPrivateIdentifierName(name) &&
				(node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledIdentifierValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledIdentifierValue)),
				) ||
					(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIdentifierValue)));
		} else if (ts.isGetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				(node.body !== undefined &&
					isPrivateIdentifierName(name) &&
					containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIdentifierValue)) ||
				unsafeIdentifierType(name, node.type);
		} else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			const name = compiledPropertyName(node.name);
			const privateReferenceMethod = name !== undefined && isHomeyReferenceKey(name);

			found =
				('body' in node &&
					node.body !== undefined &&
					privateReferenceMethod &&
					containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIdentifierValue)) ||
				(privateReferenceMethod && unsafeIdentifierType(name, node.type));
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isHomeyReferenceKey(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledIdentifierValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledIdentifierValue)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIdentifierValue)) ||
				unsafeIdentifierType(node.name.text, node.type);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = unsafeIdentifier(node.name.text, node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				(node.initializer !== undefined && unsafeIdentifier(node.name.text, node.initializer)) ||
				unsafeIdentifierType(node.name.text, node.type);
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found = compiledBindingValues(node).some((value) => names.some((name) => unsafeIdentifier(name, value)));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			found = unsafeIdentifier(compiledAssignedPropertyName(node.left), node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsCompiledEndpoint = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const isEndpointValueName = (name: string | undefined): name is string =>
		name !== undefined && isHomeyEndpointKey(name) && !/^(?:assert|is|validate)/i.test(name);
	const unsafeEndpoint = (name: string | undefined, expression: ts.Expression): boolean =>
		isEndpointValueName(name) && containsUnsafeCompiledValue(expression, isSafeEndpointValue);
	const unsafeEndpointType = (name: string | undefined, type: ts.TypeNode | undefined): boolean =>
		isEndpointValueName(name) && type !== undefined && containsUnsafeCompiledType(type, isSafeEndpointValue);
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			found = unsafeEndpoint(compiledPropertyName(node.name), node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				(node.initializer !== undefined && unsafeEndpoint(name, node.initializer)) ||
				unsafeEndpointType(name, node.type);
		} else if (ts.isPropertySignature(node)) {
			found = unsafeEndpointType(compiledPropertyName(node.name), node.type);
		} else if (ts.isSetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				isEndpointValueName(name) &&
				(node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeEndpointValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeEndpointValue)),
				) ||
					(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeEndpointValue)));
		} else if (ts.isGetAccessorDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			const name = compiledPropertyName(node.name);
			const endpointName = isEndpointValueName(name);

			found =
				('body' in node &&
					node.body !== undefined &&
					endpointName &&
					containsUnsafeCompiledBodyLiteral(node.body, isSafeEndpointValue)) ||
				(endpointName && unsafeEndpointType(name, node.type));
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isEndpointValueName(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeEndpointValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeEndpointValue)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeEndpointValue)) ||
				unsafeEndpointType(node.name.text, node.type);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = unsafeEndpoint(node.name.text, node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				(node.initializer !== undefined && unsafeEndpoint(node.name.text, node.initializer)) ||
				unsafeEndpointType(node.name.text, node.type);
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found = compiledBindingValues(node).some((value) => names.some((name) => unsafeEndpoint(name, value)));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			found = unsafeEndpoint(compiledAssignedPropertyName(node.left), node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsCompiledPersonalValue = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const isCompiledPersonalName = (name: string | undefined): name is string =>
		name !== undefined && !COMPILED_SYMBOL_NAME_PATTERN.test(name) && isHomeyPersonalKey(name);
	const isSafeCompiledPersonalValue = (value: string): boolean =>
		value === '[~2~]' ||
		isHomeyGeneratedPseudonym(value) ||
		PUBLIC_SYNTHETIC_PERSONAL_VALUES.has(value) ||
		PUBLIC_COMPILED_PERSONAL_VALUES.has(value) ||
		PUBLIC_COMPILED_PERSONAL_IDENTIFIER_PATTERN.test(value) ||
		isHomeyAddressKey(value) ||
		isHomeyEndpointKey(value) ||
		isHomeyIconKey(value) ||
		isHomeyIdentifierKey(value) ||
		isHomeyPersonalKey(value) ||
		isHomeyReferenceKey(value) ||
		isHomeySecretKey(value) ||
		isHomeyTimestampKey(value);
	const unsafePersonalValue = (name: string | undefined, expression: ts.Expression): boolean =>
		isCompiledPersonalName(name) && containsUnsafeCompiledValue(expression, isSafeCompiledPersonalValue);
	const unsafePersonalType = (name: string | undefined, type: ts.TypeNode | undefined): boolean =>
		isCompiledPersonalName(name) && type !== undefined && containsUnsafeCompiledType(type, isSafeCompiledPersonalValue);
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			found = unsafePersonalValue(compiledPropertyName(node.name), node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				(node.initializer !== undefined && unsafePersonalValue(name, node.initializer)) ||
				unsafePersonalType(name, node.type);
		} else if (ts.isPropertySignature(node)) {
			found = unsafePersonalType(compiledPropertyName(node.name), node.type);
		} else if (ts.isSetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				isCompiledPersonalName(name) &&
				(node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledPersonalValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledPersonalValue)),
				) ||
					(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledPersonalValue)));
		} else if (ts.isGetAccessorDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			const name = compiledPropertyName(node.name);
			const personalName = isCompiledPersonalName(name);

			found =
				('body' in node &&
					node.body !== undefined &&
					personalName &&
					containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledPersonalValue)) ||
				(personalName && unsafePersonalType(name, node.type));
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isCompiledPersonalName(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledPersonalValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledPersonalValue)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledPersonalValue)) ||
				unsafePersonalType(node.name.text, node.type);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = unsafePersonalValue(node.name.text, node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				(node.initializer !== undefined && unsafePersonalValue(node.name.text, node.initializer)) ||
				unsafePersonalType(node.name.text, node.type);
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found = compiledBindingValues(node).some((value) => names.some((name) => unsafePersonalValue(name, value)));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			found = unsafePersonalValue(compiledAssignedPropertyName(node.left), node.right);
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return found;
};

const containsCompiledIcon = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const isSafeCompiledIconValue = (value: string): boolean => value === '[~2~]';
	const unsafeIcon = (name: string | undefined, expression: ts.Expression): boolean =>
		name !== undefined && isHomeyIconKey(name) && containsUnsafeCompiledValue(expression, isSafeCompiledIconValue);
	const unsafeIconType = (name: string | undefined, type: ts.TypeNode | undefined): boolean =>
		name !== undefined &&
		isHomeyIconKey(name) &&
		type !== undefined &&
		containsUnsafeCompiledType(type, isSafeCompiledIconValue);
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isPropertyAssignment(node)) {
			found = unsafeIcon(compiledPropertyName(node.name), node.initializer);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found = (node.initializer !== undefined && unsafeIcon(name, node.initializer)) || unsafeIconType(name, node.type);
		} else if (ts.isPropertySignature(node)) {
			found = unsafeIconType(compiledPropertyName(node.name), node.type);
		} else if (ts.isSetAccessorDeclaration(node)) {
			const name = compiledPropertyName(node.name);

			found =
				name !== undefined &&
				isHomeyIconKey(name) &&
				(node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledIconValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledIconValue)),
				) ||
					(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIconValue)));
		} else if (ts.isGetAccessorDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			const name = compiledPropertyName(node.name);
			const iconName = name !== undefined && isHomeyIconKey(name);

			found =
				('body' in node &&
					node.body !== undefined &&
					iconName &&
					containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIconValue)) ||
				(iconName && unsafeIconType(name, node.type));
		} else if (ts.isFunctionDeclaration(node) && node.name !== undefined && isHomeyIconKey(node.name.text)) {
			found =
				node.parameters.some(
					(parameter) =>
						(parameter.initializer !== undefined &&
							containsUnsafeCompiledValue(parameter.initializer, isSafeCompiledIconValue)) ||
						(parameter.type !== undefined && containsUnsafeCompiledType(parameter.type, isSafeCompiledIconValue)),
				) ||
				(node.body !== undefined && containsUnsafeCompiledBodyLiteral(node.body, isSafeCompiledIconValue)) ||
				unsafeIconType(node.name.text, node.type);
		} else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			found = unsafeIcon(node.name.text, node.initializer);
		} else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			found =
				(node.initializer !== undefined && unsafeIcon(node.name.text, node.initializer)) ||
				unsafeIconType(node.name.text, node.type);
		} else if (ts.isBindingElement(node)) {
			const names = [
				node.propertyName === undefined ? undefined : compiledPropertyName(node.propertyName),
				ts.isIdentifier(node.name) ? node.name.text : undefined,
			];

			found = compiledBindingValues(node).some((value) => names.some((name) => unsafeIcon(name, value)));
		} else if (ts.isBinaryExpression(node) && isAssignmentOperatorKind(node.operatorToken.kind)) {
			found = unsafeIcon(compiledAssignedPropertyName(node.left), node.right);
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

	if (ts.isTemplateExpression(node)) {
		let value = node.head.text;

		for (const span of node.templateSpans) {
			const expression = compiledStaticString(span.expression);

			if (expression === undefined) {
				return undefined;
			}

			value += expression + span.literal.text;
		}

		return value;
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
			const staticString = compiledStaticString(node);

			found =
				(staticString !== undefined && containsStructuredUrl(staticString)) ||
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

const containsCompiledTimestamp = (text: string): boolean => {
	const sourceFile = ts.createSourceFile('artifact.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) {
			return;
		}

		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			found = isHomeyIsoTimestamp(node.text) && !isSafeTimestampValue(node.text);
		} else if (ts.isTemplateExpression(node)) {
			const staticString = compiledStaticString(node);

			found = staticString !== undefined && isHomeyIsoTimestamp(staticString) && !isSafeTimestampValue(staticString);
		} else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
			const staticString = compiledStaticString(node);

			found = staticString !== undefined && isHomeyIsoTimestamp(staticString) && !isSafeTimestampValue(staticString);
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

const isSafeAddressValue = (value: unknown): boolean =>
	value === null || value === 0 || value === false || value === '[~0~]';

const isSafePersonalValue = (value: unknown): boolean =>
	value === null ||
	value === 0 ||
	value === false ||
	value === '[~2~]' ||
	isHomeyGeneratedPseudonym(value) ||
	(typeof value === 'string' && PUBLIC_SYNTHETIC_PERSONAL_VALUES.has(value));

const containsStructuredAddress = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredAddress(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(([key, child]) => {
		return (isHomeyAddressKey(key) && !isSafeAddressValue(child)) || containsStructuredAddress(child);
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
		return (isHomeyPersonalKey(key) && !isSafePersonalValue(child)) || containsStructuredPersonalValue(child);
	});
};

const isSafeIdentifierValue = (value: unknown): boolean =>
	value === null ||
	value === 0 ||
	value === false ||
	isHomeyGeneratedPseudonym(value) ||
	(typeof value === 'string' &&
		(REDACTION_SENTINEL_PATTERN.test(value) || PUBLIC_SYNTHETIC_IDENTIFIER_VALUES.has(value)));

const isSafeEndpointValue = (value: unknown): boolean =>
	value === null ||
	value === 0 ||
	value === false ||
	value === '[~5~]' ||
	(typeof value === 'string' && PUBLIC_ARTIFACT_URLS.has(value));

const containsStructuredEndpoint = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredEndpoint(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(
		([key, child]) => (isHomeyEndpointKey(key) && !isSafeEndpointValue(child)) || containsStructuredEndpoint(child),
	);
};

const isSafeTimestampValue = (value: unknown): boolean =>
	value === null ||
	value === 0 ||
	value === false ||
	value === FIXTURE_TIMESTAMP ||
	(typeof value === 'string' && (PUBLIC_FIXTURE_DATES.has(value) || PUBLIC_OPENAPI_TIMESTAMPS.has(value)));

const isSafeIconValue = (value: unknown): boolean =>
	value === null || value === 0 || value === false || value === '[~2~]';

const containsStructuredIcon = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredIcon(entry));
	}

	if (value === null || typeof value !== 'object') {
		return false;
	}

	return Object.entries(value as JsonRecord).some(
		([key, child]) => (isHomeyIconKey(key) && !isSafeIconValue(child)) || containsStructuredIcon(child),
	);
};

const containsStructuredTimestamp = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => containsStructuredTimestamp(entry));
	}

	if (value === null || typeof value !== 'object') {
		return typeof value === 'string' && isHomeyIsoTimestamp(value) && !isSafeTimestampValue(value);
	}

	return Object.entries(value as JsonRecord).some(
		([key, child]) => (isHomeyTimestampKey(key) && !isSafeTimestampValue(child)) || containsStructuredTimestamp(child),
	);
};

const isCapabilityIdentifierPath = (key: string, path: readonly string[], syntheticProtocolRoot: boolean): boolean => {
	const directCapabilityEntry =
		path.length === 2 &&
		/^\d+$/.test(path[1] ?? '') &&
		(path[0] === 'capabilities' || (syntheticProtocolRoot && path[0] === 'values'));
	const directCapabilityMapEntry =
		path.length === 2 && (path[0] === 'capabilitiesObj' || path[0] === 'capabilityOptions');
	const directEnumOption =
		path.length === 4 &&
		/^\d+$/.test(path[3] ?? '') &&
		((path[0] === 'capabilities' && path[2] === 'enumValues') ||
			((path[0] === 'capabilitiesObj' || path[0] === 'capabilityOptions') && path[2] === 'values'));

	return (key === 'id' || key === 'baseId') && (directCapabilityEntry || directCapabilityMapEntry || directEnumOption);
};

const containsStructuredIdentifier = (
	value: unknown,
	path: readonly string[] = [],
	syntheticProtocolRoot = false,
): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry, index) =>
			containsStructuredIdentifier(entry, [...path, index.toString()], syntheticProtocolRoot),
		);
	}

	if (value === null || typeof value !== 'object') {
		return typeof value === 'string' && isHomeyUuid(value) && !isSafeIdentifierValue(value);
	}

	const record = value as JsonRecord;
	const nestedSyntheticProtocolRoot =
		syntheticProtocolRoot || (path.length === 0 && record.provenance === 'synthetic-protocol-contract');

	return Object.entries(record).some(([key, child]) => {
		const childPath = [...path, key];
		const identifierKey = isHomeyUuid(key) && !isSafeIdentifierValue(key);
		const capabilityIdentifierPath = isCapabilityIdentifierPath(key, path, nestedSyntheticProtocolRoot);
		const capabilityIdentifierValue = capabilityIdentifierPath && !isHomeySanitizedCapabilityIdentifier(child);
		const capabilityListValue =
			key === 'capabilities' &&
			Array.isArray(child) &&
			child.some((entry) => typeof entry === 'string' && !isHomeySanitizedCapabilityIdentifier(entry));
		const capabilityMapKey =
			(key === 'capabilitiesObj' || key === 'capabilityOptions') &&
			child !== null &&
			typeof child === 'object' &&
			!Array.isArray(child) &&
			Object.keys(child as JsonRecord).some((entryKey) => !isHomeySanitizedCapabilityIdentifier(entryKey));
		const identifierMapValue =
			isHomeyIdentifierMapKey(key) &&
			child !== null &&
			typeof child === 'object' &&
			!Array.isArray(child) &&
			Object.keys(child as JsonRecord).some(
				(entryKey) => !isHomeyGeneratedPseudonym(entryKey) && !PUBLIC_SYNTHETIC_IDENTIFIER_VALUES.has(entryKey),
			);
		const identifierValue =
			!isHomeyReferenceArrayKey(key) &&
			(isHomeyReferenceKey(key) || isHomeyIdentifierKey(key)) &&
			!capabilityIdentifierPath &&
			!isSafeIdentifierValue(child);
		const referenceArrayValue =
			isHomeyReferenceArrayKey(key) &&
			(Array.isArray(child) ? child.some((entry) => !isSafeIdentifierValue(entry)) : !isSafeIdentifierValue(child));

		return (
			identifierKey ||
			capabilityIdentifierValue ||
			capabilityListValue ||
			capabilityMapKey ||
			identifierMapValue ||
			identifierValue ||
			referenceArrayValue ||
			containsStructuredIdentifier(child, childPath, nestedSyntheticProtocolRoot)
		);
	});
};

const loosePropertyAssignments = (text: string): ReadonlyArray<readonly [string, string]> =>
	[...text.matchAll(LOOSE_PROPERTY_PATTERN)].flatMap((match) => {
		const key = match[1]?.trim();
		const rawValue = (match[3] ?? match[4])?.replace(/\s+#.*$/, '').trim();

		if (key === undefined || rawValue === undefined) {
			return [];
		}

		return [[key, rawValue] as const];
	});

const containsLooseSecretAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(
		([key, rawValue]) =>
			isHomeySecretKey(key) && !['', '0', '[~3~]', 'false', 'null', 'true', 'undefined'].includes(rawValue),
	);

const containsLooseAddressAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(
		([key, rawValue]) => isHomeyAddressKey(key) && !['0', '[~0~]', 'false', 'null'].includes(rawValue),
	);

const containsLoosePersonalAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(
		([key, rawValue]) =>
			isHomeyPersonalKey(key) &&
			!['0', '[~2~]', 'false', 'null'].includes(rawValue) &&
			!isHomeyGeneratedPseudonym(rawValue) &&
			!PUBLIC_SYNTHETIC_PERSONAL_VALUES.has(rawValue),
	);

const containsLooseEndpointAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(([key, rawValue]) => isHomeyEndpointKey(key) && !isSafeEndpointValue(rawValue));

const containsLooseIdentifierAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(([key, rawValue]) => {
		const unambiguousIdentifierKey =
			isHomeyReferenceKey(key) || (isHomeyIdentifierKey(key) && key !== 'id' && key !== 'baseId');

		return (
			unambiguousIdentifierKey && !['0', '[]', 'false', 'null'].includes(rawValue) && !isSafeIdentifierValue(rawValue)
		);
	});

const containsLooseTimestampAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(
		([key, rawValue]) =>
			(isHomeyTimestampKey(key) &&
				!['0', 'false', 'null', FIXTURE_TIMESTAMP].includes(rawValue) &&
				!PUBLIC_FIXTURE_DATES.has(rawValue)) ||
			(isHomeyIsoTimestamp(rawValue) && !isSafeTimestampValue(rawValue)),
	);

const containsLooseIconAssignment = (text: string): boolean =>
	loosePropertyAssignments(text).some(
		([key, rawValue]) => isHomeyIconKey(key) && !['0', '[~2~]', 'false', 'null'].includes(rawValue),
	);

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

	if (compiledSource && containsCompiledAddress(text)) {
		throw new Error(`${label} contains a compiled address value`);
	}

	if (compiledSource && containsCompiledIdentifier(text)) {
		throw new Error(`${label} contains a compiled identifier value`);
	}

	if (compiledSource && containsCompiledEndpoint(text)) {
		throw new Error(`${label} contains a compiled endpoint value`);
	}

	if (compiledSource && containsCompiledPersonalValue(text)) {
		throw new Error(`${label} contains a compiled personal value`);
	}

	if (compiledSource && containsCompiledIcon(text)) {
		throw new Error(`${label} contains a compiled icon value`);
	}

	if (compiledSource && containsCompiledTimestamp(text)) {
		throw new Error(`${label} contains a compiled timestamp value`);
	}

	for (const privateValue of configuredPrivateValues()) {
		if (text.toLocaleLowerCase().includes(privateValue.toLocaleLowerCase())) {
			throw new Error(`${label} contains a configured private Homey value`);
		}
	}
};

const assertFixtureTextSafe = (
	label: string,
	text: string,
	extension: string,
	checkPersonalValues = true,
	checkIdentifiers = true,
): void => {
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

	const containsEndpoint =
		structuredValue === undefined ? containsLooseEndpointAssignment(text) : containsStructuredEndpoint(structuredValue);

	if (containsEndpoint) {
		throw new Error(`${label} contains a structured endpoint value`);
	}

	const containsTimestamp =
		structuredValue === undefined
			? containsLooseTimestampAssignment(text)
			: containsStructuredTimestamp(structuredValue);

	if (containsTimestamp) {
		throw new Error(`${label} contains a structured timestamp value`);
	}

	const containsIcon =
		structuredValue === undefined ? containsLooseIconAssignment(text) : containsStructuredIcon(structuredValue);

	if (containsIcon) {
		throw new Error(`${label} contains a structured icon value`);
	}

	const containsSecret =
		structuredValue === undefined ? containsLooseSecretAssignment(text) : containsStructuredSecret(structuredValue);

	if (containsSecret) {
		throw new Error(`${label} contains a structured secret value`);
	}

	const containsAddress =
		structuredValue === undefined ? containsLooseAddressAssignment(text) : containsStructuredAddress(structuredValue);

	if (containsAddress) {
		throw new Error(`${label} contains a structured address value`);
	}

	const containsPersonalValue =
		structuredValue === undefined
			? containsLoosePersonalAssignment(text)
			: containsStructuredPersonalValue(structuredValue);

	if (checkPersonalValues && containsPersonalValue) {
		throw new Error(`${label} contains a structured personal value`);
	}

	const containsIdentifier =
		structuredValue === undefined
			? containsLooseIdentifierAssignment(text)
			: containsStructuredIdentifier(structuredValue);

	if (checkIdentifiers && containsIdentifier) {
		throw new Error(`${label} contains a structured identifier value`);
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
	addressParameter = false,
	personalParameter = false,
	identifierParameter = false,
	endpointParameter = false,
	iconParameter = false,
	timestampParameter = false,
): void => {
	if (Array.isArray(value)) {
		value.forEach((entry, index) =>
			visitPublishedValues(
				label,
				entry,
				[...path, index.toString()],
				secretParameter,
				addressParameter,
				personalParameter,
				identifierParameter,
				endpointParameter,
				iconParameter,
				timestampParameter,
			),
		);

		return;
	}

	if (value === null || typeof value !== 'object') {
		return;
	}

	const record = value as JsonRecord;
	const parameterName = typeof record.name === 'string' ? record.name : undefined;
	const nestedSecretParameter = secretParameter || (parameterName !== undefined && isHomeySecretKey(parameterName));
	const nestedAddressParameter = addressParameter || (parameterName !== undefined && isHomeyAddressKey(parameterName));
	const nestedPersonalParameter =
		personalParameter || (parameterName !== undefined && isHomeyPersonalKey(parameterName));
	const nestedIdentifierParameter =
		identifierParameter ||
		(parameterName !== undefined && (isHomeyReferenceKey(parameterName) || isHomeyIdentifierKey(parameterName)));
	const nestedEndpointParameter =
		endpointParameter || (parameterName !== undefined && isHomeyEndpointKey(parameterName));
	const nestedIconParameter = iconParameter || (parameterName !== undefined && isHomeyIconKey(parameterName));
	const nestedTimestampParameter =
		timestampParameter || (parameterName !== undefined && isHomeyTimestampKey(parameterName));

	for (const [key, child] of Object.entries(record)) {
		const childPath = [...path, key];

		if (['default', 'enum', 'example', 'examples'].includes(key)) {
			if (containsStructuredSecret(child) || (nestedSecretParameter && containsUnsafeSecretLeaf(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes a secret value`);
			}

			if (containsStructuredUrl(child)) {
				throw new Error(`${label}.${childPath.join('.')} publishes a URL`);
			}

			if (containsStructuredEndpoint(child) || (nestedEndpointParameter && !isSafeEndpointValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes an endpoint value`);
			}

			if (containsStructuredIcon(child) || (nestedIconParameter && !isSafeIconValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes an icon value`);
			}

			if (containsStructuredTimestamp(child) || (nestedTimestampParameter && !isSafeTimestampValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes a timestamp value`);
			}

			if (containsStructuredAddress(child) || (nestedAddressParameter && !isSafeAddressValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes an address value`);
			}

			if (containsStructuredPersonalValue(child) || (nestedPersonalParameter && !isSafePersonalValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes a personal value`);
			}

			if (containsStructuredIdentifier(child) || (nestedIdentifierParameter && !isSafeIdentifierValue(child))) {
				throw new Error(`${label}.${childPath.join('.')} publishes an identifier value`);
			}
		}

		visitPublishedValues(
			label,
			child,
			childPath,
			nestedSecretParameter,
			nestedAddressParameter,
			nestedPersonalParameter,
			nestedIdentifierParameter,
			nestedEndpointParameter,
			nestedIconParameter,
			nestedTimestampParameter,
		);
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
				assertFixtureTextSafe(label, text, extension, false, false);
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
		expect(() =>
			visitPublishedValues('UnsafeHomeyOperation', {
				parameters: [{ name: 'hostname', schema: { example: 'family-homey.local' } }],
			}),
		).toThrow('UnsafeHomeyOperation.parameters.0.schema.example publishes an address value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { name: 'Alice Bedroom' },
			}),
		).toThrow('UnsafeHomeySchema.example publishes a personal value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { deviceId: 'opaque-household-id' },
			}),
		).toThrow('UnsafeHomeySchema.example publishes an identifier value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { endpoint: 'private-homey.local:4859' },
			}),
		).toThrow('UnsafeHomeySchema.example publishes an endpoint value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { icon: 'custom-household-icon' },
			}),
		).toThrow('UnsafeHomeySchema.example publishes an icon value');
		expect(() =>
			visitPublishedValues('UnsafeHomeySchema', {
				example: { updatedAt: '2026-08-25T12:34:56.000Z' },
			}),
		).toThrow('UnsafeHomeySchema.example publishes a timestamp value');
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
		expect(() =>
			assertFixtureTextSafe('unsafe fixture', '{"deviceId":"8d4d7584-1111-4111-8111-0123456789ab"}', '.json'),
		).toThrow('unsafe fixture contains a structured identifier value');
		expect(() =>
			assertFixtureTextSafe('unsafe fixture', '{"metadata":{"8d4d7584-1111-4111-8111-0123456789ab":{}}}', '.json'),
		).toThrow('unsafe fixture contains a structured identifier value');
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"driverId":"opaque-driver"}', '.json')).toThrow(
			'unsafe fixture contains a structured identifier value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"deviceIds":"opaque-household-id"}', '.json')).toThrow(
			'unsafe fixture contains a structured identifier value',
		);
		expect(() =>
			assertFixtureTextSafe(
				'safe fixture',
				'{"deviceId":"device-000001","ownerUri":"[~5~]","capabilities":[{"id":"onoff","baseId":"onoff"}]}',
				'.json',
			),
		).not.toThrow();
		expect(() =>
			assertFixtureTextSafe('unsafe fixture', '{"capabilities":[{"metadata":{"id":"opaque-household-id"}}]}', '.json'),
		).toThrow('unsafe fixture contains a structured identifier value');
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"devices":{"abc123":{}}}', '.json')).toThrow(
			'unsafe fixture contains a structured identifier value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"endpoint":"private-homey.local:4859"}', '.json')).toThrow(
			'unsafe fixture contains a structured endpoint value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"capabilities":["onoff.private-device"]}', '.json')).toThrow(
			'unsafe fixture contains a structured identifier value',
		);
		expect(() =>
			assertFixtureTextSafe('safe fixture', '{"capabilities":["onoff.capability-suffix-000001"]}', '.json'),
		).not.toThrow();
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"updatedAt":"2026-08-25T12:34:56.000Z"}', '.json')).toThrow(
			'unsafe fixture contains a structured timestamp value',
		);
		expect(() =>
			assertFixtureTextSafe('unsafe fixture', '{"observation":"2026-08-25T12:34:56.000Z"}', '.json'),
		).toThrow('unsafe fixture contains a structured timestamp value');
		expect(() => assertFixtureTextSafe('unsafe fixture', '{"icon":"custom-household-icon"}', '.json')).toThrow(
			'unsafe fixture contains a structured icon value',
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
		expect(() => assertFixtureTextSafe('unsafe fixture', 'hostname: family-homey.local', '.md')).toThrow(
			'unsafe fixture contains a structured address value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', 'name: Alice Bedroom', '.txt')).toThrow(
			'unsafe fixture contains a structured personal value',
		);
		expect(() => assertFixtureTextSafe('unsafe fixture', 'deviceId: opaque-household-id', '.md')).toThrow(
			'unsafe fixture contains a structured identifier value',
		);
		expect(() =>
			assertFixtureTextSafe('safe fixture', 'hostname: [~0~]\nname: device-label-000001', '.md'),
		).not.toThrow();
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
			assertTextSafe(
				'safe compiled module',
				"const secretFields = [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] }];",
				true,
			),
		).not.toThrow();
		expect(() => assertTextSafe('unsafe compiled module', "const secretFields = ['opaque-secret'];", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe declaration', "interface Config { apiKey: 'opaque-secret' }", true)).toThrow(
			'unsafe declaration contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "const apiKey = () => 'opaque-secret';", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "const apiKey = (() => 'opaque-secret')();", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', "const apiKey = function () { return 'opaque-secret'; };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const apiKey = () => { const value = 'opaque-secret'; return value; };",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const fallback = 'opaque-secret'; const apiKey = fallback;", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const fallback = () => 'opaque-secret'; const apiKey = fallback();",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const fallback = value => 'opaque-secret'; const apiKey = fallback('');",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { fallback: () => 'opaque-secret' }; const apiKey = source.fallback();",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { fallback: () => 'opaque-secret' }; const apiKey = source['fallback']();",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"function fallback() { return 'opaque-secret'; } const apiKey = fallback();",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"function first() { const fallback = 'opaque-secret'; const apiKey = fallback; } function second() { const fallback = ''; return fallback; }",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe declaration', "declare function connect(apiKey: 'opaque-secret'): void", true),
		).toThrow('unsafe declaration contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe declaration', "declare function connect(hostname: 'family-homey.local'): void", true),
		).toThrow('unsafe declaration contains a compiled address value');
		expect(() =>
			assertTextSafe('unsafe declaration', "declare function connect(deviceId: 'opaque-household-id'): void", true),
		).toThrow('unsafe declaration contains a compiled identifier value');
		expect(() =>
			assertTextSafe(
				'unsafe declaration',
				"declare function connect(endpoint: 'private-homey.local:4859'): void",
				true,
			),
		).toThrow('unsafe declaration contains a compiled endpoint value');
		expect(() =>
			assertTextSafe('unsafe declaration', "declare function connect(deviceName: 'Alice Bedroom'): void", true),
		).toThrow('unsafe declaration contains a compiled personal value');
		expect(() => assertTextSafe('unsafe compiled module', "const hostname = 'family-homey.local';", true)).toThrow(
			'unsafe compiled module contains a compiled address value',
		);
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"class Config { set hostname(value) { this.value = value || 'family-homey.local'; } }",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled address value');
		expect(() => assertTextSafe('unsafe compiled module', "const deviceId = 'opaque-household-id';", true)).toThrow(
			'unsafe compiled module contains a compiled identifier value',
		);
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"class Config { set deviceId(value) { this.value = value || 'opaque-household-id'; } }",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled identifier value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const endpoint = 'private-homey.local:4859';", true),
		).toThrow('unsafe compiled module contains a compiled endpoint value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"class Config { set endpoint(value) { this.value = value || 'private-homey.local:4859'; } }",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled endpoint value');
		expect(() => assertTextSafe('unsafe compiled module', "const deviceName = 'Alice Bedroom';", true)).toThrow(
			'unsafe compiled module contains a compiled personal value',
		);
		expect(() => assertTextSafe('unsafe compiled module', "const icon = 'custom-household-icon';", true)).toThrow(
			'unsafe compiled module contains a compiled icon value',
		);
		expect(() =>
			assertTextSafe('unsafe compiled module', "const updatedAt = '2026-08-25T12:34:56.000Z';", true),
		).toThrow('unsafe compiled module contains a compiled timestamp value');
		expect(() =>
			assertTextSafe('unsafe declaration', "interface Config { hostname: 'family-homey.local' }", true),
		).toThrow('unsafe declaration contains a compiled address value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const config = { api_key: 'opaque-secret' };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const apiKey = { read() { return 'opaque-secret'; } };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const apiKey = { ...{ value: 'opaque-secret' } };", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() => assertTextSafe('unsafe compiled module', "const apiKey = [...['opaque-secret']];", true)).toThrow(
			'unsafe compiled module contains a compiled secret value',
		);
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"class Config { set apiKey(value) { this.value = value || 'opaque-secret'; } }",
				true,
			),
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
			assertTextSafe('unsafe compiled module', "const { apiKey: key = 'opaque-secret' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const { value: apiKey = 'opaque-secret' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const { value: hostname = 'family-homey.local' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled address value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const { value: deviceId = 'opaque-household-id' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled identifier value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const { value: endpoint = 'private-homey.local:4859' } = config;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled endpoint value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const { value: deviceName = 'Alice Bedroom' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled personal value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const { value: icon = 'custom-household-icon' } = config;", true),
		).toThrow('unsafe compiled module contains a compiled icon value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'opaque-secret' }; const { value: apiKey } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'family-homey.local' }; const { value: hostname } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled address value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'opaque-household-id' }; const { value: deviceId } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled identifier value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'private-homey.local:4859' }; const { value: endpoint } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled endpoint value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'Alice Bedroom' }; const { value: deviceName } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled personal value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'custom-household-icon' }; const { value: icon } = source;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled icon value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'opaque-secret' }; const apiKey = source.value;",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = { value: 'opaque-secret' }; const apiKey = source['value'];",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "const source = ['opaque-secret']; const apiKey = source[0];", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe(
				'unsafe compiled module',
				"const source = [...['safe', 'opaque-secret']]; const apiKey = source[1];",
				true,
			),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function apiKey() { return 'opaque-secret'; }", true),
		).toThrow('unsafe compiled module contains a compiled secret value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function hostname() { return 'family-homey.local'; }", true),
		).toThrow('unsafe compiled module contains a compiled address value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function deviceId() { return 'opaque-household-id'; }", true),
		).toThrow('unsafe compiled module contains a compiled identifier value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function endpoint() { return 'private-homey.local:4859'; }", true),
		).toThrow('unsafe compiled module contains a compiled endpoint value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function deviceName() { return 'Alice Bedroom'; }", true),
		).toThrow('unsafe compiled module contains a compiled personal value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "function icon() { return 'custom-household-icon'; }", true),
		).toThrow('unsafe compiled module contains a compiled icon value');
		expect(() =>
			assertTextSafe('unsafe compiled module', "class Config { get apiKey() { return 'opaque-secret'; } }", true),
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
		expect(() =>
			assertTextSafe('unsafe compiled module', "const endpoint = `http://${'private-homey.local'}:4859`;", true),
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

			process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID = 'onoff';
			expect(() => assertTextSafe('safe fixture', '{"capability":"onoff"}')).not.toThrow();
			process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID = 'power_on_behavior';
			process.env.FB_HOMEY_SHS_WRITE_VALUE = '"off"';
			expect(() => assertTextSafe('safe fixture', '{"value":"off"}')).not.toThrow();
			process.env.FB_HOMEY_SHS_WRITE_CAPABILITY_ID = 'onoff.private-device';
			process.env.FB_HOMEY_SHS_WRITE_VALUE = '"private-write-value"';
			expect(() => assertTextSafe('unsafe fixture', '{"capability":"onoff.private-device"}')).toThrow(
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
