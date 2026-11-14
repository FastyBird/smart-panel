/**
 * The YAML document an automation is exported as and imported from (design § JSON and YAML). Framework-free
 * (ADR 0003, decision 15), so the format is tested directly.
 *
 * The document holds what makes the automation and nothing that belongs to the installation it came from: no
 * automation id, revision, enabled state, status or timestamps. It keeps the node and edge ids, so an export
 * imported again reproduces the graph. Entities the nodes refer to - devices, properties, scenes, spaces,
 * automations - stay as their ids; an import says which of them do not exist where it is loaded.
 *
 * ```yaml
 * version: 1
 * kind: automation
 * name: Hallway motion light
 * description: Turns the hallway light on at night   # left out when there is none
 * icon: mdi:motion-sensor                             # left out when there is none
 * mode: restart
 * space_id: 550e8400-e29b-41d4-a716-446655440000     # left out when there is none
 * graph:
 *   nodes:
 *     - id: n1
 *       type: device.property.changed
 *       position: { x: 40, y: 80 }
 *       config: { ... }
 *   edges:
 *     - { id: e1, source: n1, source_port: out, target: n2, target_port: in }
 * ```
 */
import { Document, LineCounter, parseDocument } from 'yaml';

import {
	AUTOMATION_GRAPH_VERSION,
	AUTOMATION_IMPORT_MAX_DEPTH,
	AUTOMATION_IMPORT_MAX_LENGTH,
	AUTOMATION_YAML_KIND,
	AUTOMATION_YAML_VERSION,
} from '../automations.constants';

/** What an automation is exported from */
export interface AutomationExportSource {
	name: string;
	description: string | null;
	icon: string | null;
	mode: string;
	spaceId: string | null;
	graph: {
		nodes: { id: string; type: string; position: { x: number; y: number }; config?: Record<string, unknown> }[];
		edges: { id: string; source: string; source_port: string; target: string; target_port: string }[];
	};
}

/**
 * One reason an import file was refused, addressed to the part of the document it is about (`graph.nodes.0.type`).
 * A reason is shown to the caller, so it describes the rule that was broken and does not repeat the value.
 */
export interface AutomationImportProblem {
	field: string;
	reason: string;
}

/**
 * What a valid import file holds, in the shape an automation is created from: the fields of the create request
 * without an id or the enabled state, and the graph as a graph document. Only the structure of the document is
 * checked here; the fields themselves are checked by the create request rules.
 */
export interface AutomationImportData {
	name: unknown;
	description?: unknown;
	icon?: unknown;
	mode?: unknown;
	space_id?: unknown;
	graph: { version: number; nodes: unknown[]; edges: unknown[] };
}

export type AutomationYamlParseResult =
	| { data: AutomationImportData; problems: [] }
	| { data: null; problems: AutomationImportProblem[] };

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
	'version',
	'kind',
	'name',
	'description',
	'icon',
	'mode',
	'space_id',
	'graph',
]);

const GRAPH_KEYS: ReadonlySet<string> = new Set(['nodes', 'edges']);

const FILE_NAME_MAX_LENGTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** The YAML document of an automation, as a value */
const toAutomationYamlDocument = (source: AutomationExportSource): Record<string, unknown> => {
	const document: Record<string, unknown> = {
		version: AUTOMATION_YAML_VERSION,
		kind: AUTOMATION_YAML_KIND,
		name: source.name,
	};

	if (source.description !== null && source.description !== '') document.description = source.description;
	if (source.icon !== null && source.icon !== '') document.icon = source.icon;

	document.mode = source.mode;

	if (source.spaceId !== null) document.space_id = source.spaceId;

	document.graph = {
		nodes: source.graph.nodes.map((node) => ({
			id: node.id,
			type: node.type,
			position: { x: node.position.x, y: node.position.y },
			config: node.config ?? {},
		})),
		edges: source.graph.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			source_port: edge.source_port,
			target: edge.target,
			target_port: edge.target_port,
		})),
	};

	return document;
};

/** Serialises an automation into its YAML document */
export const serializeAutomationYaml = (source: AutomationExportSource): string => {
	// A value used twice is written out twice: the import refuses aliases
	const yaml = new Document(toAutomationYamlDocument(source), { aliasDuplicateObjects: false });

	yaml.commentBefore = ' Smart Panel automation';

	return yaml.toString({ lineWidth: 0 });
};

/** The name of the file an automation is downloaded as: its name in lowercase ASCII words joined by dashes */
export const automationExportFileName = (name: string): string => {
	const slug = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, FILE_NAME_MAX_LENGTH)
		.replace(/-+$/g, '');

	return `${slug !== '' ? slug : 'automation'}.yaml`;
};

/** How many UTF-8 bytes the export of an automation takes */
export const automationExportSize = (source: AutomationExportSource): number =>
	Buffer.byteLength(serializeAutomationYaml(source), 'utf8');

/**
 * Why an automation could not be imported again once exported: its YAML document is larger than an import file
 * may be, or nests deeper. A save checks this, so every automation it stores can be restored from its export.
 * Null when it fits.
 */
export const automationExportProblem = (source: AutomationExportSource): string | null => {
	if (tooDeep(toAutomationYamlDocument(source), 0)) {
		return `The configuration of a block may not be nested this deeply: an automation is kept to ${AUTOMATION_IMPORT_MAX_DEPTH} levels, so that it can be exported and imported again.`;
	}

	if (automationExportSize(source) > AUTOMATION_IMPORT_MAX_LENGTH) {
		return `The automation is too large: exported, it would be larger than ${AUTOMATION_IMPORT_MAX_LENGTH / 1024} KB, the most that can be imported again. Remove blocks or shorten their configuration.`;
	}

	return null;
};

/**
 * Where the document holds a value an automation can not store - it is kept as JSON, which has no NaN, no
 * infinity and no big integers - as a dot-separated path, or null when it holds none. Called on a value already
 * known to be shallow.
 */
const unsupportedValuePath = (value: unknown, path: (string | number)[]): string | null => {
	const here = (): string => (path.length > 0 ? path.join('.') : 'yaml');

	if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;

	if (typeof value === 'number') return Number.isFinite(value) ? null : here();

	if (Array.isArray(value)) {
		for (const [index, item] of (value as unknown[]).entries()) {
			const found = unsupportedValuePath(item, [...path, index]);

			if (found !== null) return found;
		}

		return null;
	}

	if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
		for (const [key, item] of Object.entries(value)) {
			const found = unsupportedValuePath(item, [...path, key]);

			if (found !== null) return found;
		}

		return null;
	}

	// undefined, a big integer, a date, a set or anything else that is not plain JSON
	return here();
};

/** Whether a value nests deeper than the limit; stops looking as soon as it does */
const tooDeep = (value: unknown, depth: number): boolean => {
	if (typeof value !== 'object' || value === null) return false;

	if (depth >= AUTOMATION_IMPORT_MAX_DEPTH) return true;

	const children = Array.isArray(value) ? (value as unknown[]) : Object.values(value);

	return children.some((child) => tooDeep(child, depth + 1));
};

const yamlProblem = (error: { code: string; pos: [number, number] }, lines: LineCounter): string => {
	const position = lines.linePos(error.pos[0]);

	return `The file is not valid YAML (${error.code}) at line ${position.line}, column ${position.col}.`;
};

/**
 * Reads an import file. The YAML is read with the core schema only: a tag that is not a plain YAML type, an
 * alias, a second document or a duplicate key refuses the file, and so does a file larger than
 * AUTOMATION_IMPORT_MAX_LENGTH or values nested deeper than AUTOMATION_IMPORT_MAX_DEPTH.
 */
export const parseAutomationYaml = (text: string): AutomationYamlParseResult => {
	const refuse = (field: string, reason: string): AutomationYamlParseResult => ({
		data: null,
		problems: [{ field, reason }],
	});

	if (Buffer.byteLength(text, 'utf8') > AUTOMATION_IMPORT_MAX_LENGTH) {
		return refuse('yaml', `The file is larger than ${AUTOMATION_IMPORT_MAX_LENGTH / 1024} KB.`);
	}

	if (text.trim() === '') {
		return refuse('yaml', 'The file is empty.');
	}

	let value: unknown;

	try {
		const lines = new LineCounter();

		const document = parseDocument(text, {
			lineCounter: lines,
			schema: 'core',
			merge: false,
			uniqueKeys: true,
			prettyErrors: false,
			strict: true,
		});

		const failure = document.errors[0] ?? document.warnings[0];

		if (failure) {
			return refuse('yaml', yamlProblem(failure, lines));
		}

		// No alias may be resolved: an export never has one, and they are how a small file grows huge
		value = document.toJS({ maxAliasCount: 0 });
	} catch (error) {
		if (error instanceof RangeError) {
			return refuse('yaml', `Values may not be nested more than ${AUTOMATION_IMPORT_MAX_DEPTH} levels deep.`);
		}

		const message = error instanceof Error && /alias/i.test(error.message) ? 'Aliases are not allowed.' : null;

		return refuse('yaml', message ?? 'The file could not be read as YAML.');
	}

	if (!isRecord(value)) {
		return refuse('yaml', 'The file must hold one automation document.');
	}

	if (tooDeep(value, 0)) {
		return refuse('yaml', `Values may not be nested more than ${AUTOMATION_IMPORT_MAX_DEPTH} levels deep.`);
	}

	const unsupported = unsupportedValuePath(value, []);

	if (unsupported !== null) {
		return refuse(
			unsupported,
			'Only finite numbers, texts, yes/no values, null, lists and mappings can be imported; .nan and .inf can not.',
		);
	}

	const problems: AutomationImportProblem[] = [];

	if (value.kind !== AUTOMATION_YAML_KIND) {
		problems.push({ field: 'kind', reason: `The document must be of kind "${AUTOMATION_YAML_KIND}".` });
	}

	if (value.version !== AUTOMATION_YAML_VERSION) {
		problems.push({
			field: 'version',
			reason: `The document version must be ${AUTOMATION_YAML_VERSION}; files of other versions can not be imported.`,
		});
	}

	for (const key of Object.keys(value)) {
		if (!TOP_LEVEL_KEYS.has(key)) {
			problems.push({ field: key, reason: 'The document may not hold this key.' });
		}
	}

	const graph = value.graph ?? {};

	if (!isRecord(graph)) {
		problems.push({ field: 'graph', reason: 'The graph must be a mapping with nodes and edges.' });
	} else {
		for (const key of Object.keys(graph)) {
			if (!GRAPH_KEYS.has(key)) {
				problems.push({ field: `graph.${key}`, reason: 'The graph may not hold this key.' });
			}
		}

		for (const key of GRAPH_KEYS) {
			if (graph[key] !== undefined && graph[key] !== null && !Array.isArray(graph[key])) {
				problems.push({ field: `graph.${key}`, reason: `The ${key} of the graph must be a list.` });
			}
		}
	}

	if (problems.length > 0 || !isRecord(graph)) {
		return { data: null, problems };
	}

	const listOf = (list: unknown): unknown[] => (Array.isArray(list) ? (list as unknown[]) : []);

	const data: AutomationImportData = {
		name: value.name,
		graph: {
			version: AUTOMATION_GRAPH_VERSION,
			// A node without a configuration is one whose card takes none
			nodes: listOf(graph.nodes).map((node) =>
				isRecord(node) && (node.config === undefined || node.config === null) ? { ...node, config: {} } : node,
			),
			edges: listOf(graph.edges),
		},
	};

	for (const key of ['description', 'icon', 'mode', 'space_id'] as const) {
		if (value[key] !== undefined) data[key] = value[key];
	}

	return { data, problems: [] };
};
