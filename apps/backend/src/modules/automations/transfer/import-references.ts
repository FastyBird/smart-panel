/**
 * The entities an imported automation refers to, which of them do not exist where it is imported, and pointing
 * a reference at another entity of the same kind. Framework-free (ADR 0003, decision 15).
 *
 * A node says what it refers to through `references()` of its node type, as it does for the cleanup when an
 * entity is removed, and where in its configuration each reference is held (`path`). Only that field is ever
 * rewritten: a value that merely equals an id - the literal a comparison checks against, say - is left alone. A
 * reference whose node type does not say where it is held, or whose path does not hold its id, is reported but
 * can not be pointed elsewhere.
 *
 * A device property target - a property reference next to the channel and device references of the same object,
 * the way every device card stores it - is one reference of kind `property`: it exists when the property belongs
 * to that channel of that device, and pointing it at another property moves the channel and the device with it.
 * The space an automation belongs to is a reference of kind `space` that no node holds.
 */
import { AutomationNodeReferenceKind, AutomationNodeTypeLookup } from '../graph/node-type';

export type AutomationConfigPath = (string | number)[];

/** The space the automation belongs to, addressed as a field of the automation and not of a node */
export const AUTOMATION_SPACE_FIELD = 'space_id';

export interface AutomationReferenceUse {
	kind: AutomationNodeReferenceKind;
	id: string;
	/** The node holding the reference; null for the space of the automation itself */
	nodeId: string | null;
	/**
	 * Where in the node configuration the id is held; `['space_id']` for the space of the automation. Null when the
	 * node type does not say, and then the reference can not be pointed elsewhere.
	 */
	path: AutomationConfigPath | null;
	/** For a device property target: where its channel and device ids are held next to the property id */
	target?: {
		channel?: { id: string; path: AutomationConfigPath };
		device?: { id: string; path: AutomationConfigPath };
	};
}

export interface AutomationReferenceGraph {
	nodes: { id: string; type: string; config: Record<string, unknown> }[];
}

export interface AutomationReferenceUsage {
	nodeId: string | null;
	/** The dot-separated path of the field holding it, in the node configuration or of the automation; null when unknown */
	field: string | null;
}

export interface AutomationMissingReference {
	kind: AutomationNodeReferenceKind;
	id: string;
	usages: AutomationReferenceUsage[];
	/** Whether every use is in a known field, so a mapping points all of them elsewhere */
	remappable: boolean;
}

/** What the import needs to know about the entities of the installation */
export interface AutomationReferenceLookup {
	exists(kind: AutomationNodeReferenceKind, id: string): Promise<boolean>;
	/** Whether the property exists and, when they are given, belongs to that channel of that device */
	propertyTargetExists(propertyId: string, channelId?: string, deviceId?: string): Promise<boolean>;
}

/** A reference to point elsewhere; for a property, the channel and device the new property belongs to */
export interface AutomationResolvedReferenceMapping {
	kind: AutomationNodeReferenceKind;
	id: string;
	to: string;
	channelId?: string;
	deviceId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const valueAt = (value: unknown, path: AutomationConfigPath): unknown => {
	let current = value;

	for (const segment of path) {
		if (typeof current !== 'object' || current === null) return undefined;

		current = (current as Record<string | number, unknown>)[segment];
	}

	return current;
};

const setAt = (value: Record<string, unknown>, path: AutomationConfigPath, next: string): void => {
	const parent = valueAt(value, path.slice(0, -1));

	if (typeof parent === 'object' && parent !== null) {
		(parent as Record<string | number, unknown>)[path[path.length - 1]] = next;
	}
};

const samePath = (a: AutomationConfigPath, b: AutomationConfigPath): boolean =>
	a.length === b.length && a.every((segment, index) => segment === b[index]);

const isPath = (value: unknown): value is AutomationConfigPath =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every((segment) => typeof segment === 'string' || (typeof segment === 'number' && Number.isInteger(segment)));

export const formatConfigPath = (path: AutomationConfigPath): string => path.join('.');

interface LocatedReference {
	kind: AutomationNodeReferenceKind;
	id: string;
	/** Null when the node type gave none, or one that does not hold the id */
	path: AutomationConfigPath | null;
}

const referencesOf = (
	lookup: AutomationNodeTypeLookup,
	node: AutomationReferenceGraph['nodes'][number],
): LocatedReference[] => {
	const nodeType = lookup(node.type);

	if (!nodeType || !isRecord(node.config)) return [];

	let references: unknown;

	try {
		references = nodeType.references(node.config);
	} catch {
		// A node type that can not tell its references of this configuration refers to nothing that can be remapped
		return [];
	}

	const seen = new Set<string>();
	const located: LocatedReference[] = [];

	for (const reference of Array.isArray(references) ? (references as unknown[]) : []) {
		if (
			!isRecord(reference) ||
			typeof reference.kind !== 'string' ||
			typeof reference.id !== 'string' ||
			reference.id === ''
		) {
			continue;
		}

		// A path is trusted only when it holds the very id it is given for
		const path =
			isPath(reference.path) && valueAt(node.config, reference.path) === reference.id ? [...reference.path] : null;

		const key = `${reference.kind}:${reference.id}:${path ? JSON.stringify(path) : ''}`;

		if (seen.has(key)) continue;

		seen.add(key);
		located.push({ kind: reference.kind as AutomationNodeReferenceKind, id: reference.id, path });
	}

	return located;
};

/** Where a node holds each entity it refers to */
const usesOfNode = (
	lookup: AutomationNodeTypeLookup,
	node: AutomationReferenceGraph['nodes'][number],
): AutomationReferenceUse[] => {
	const references = referencesOf(lookup, node);

	const consumed: AutomationConfigPath[] = [];
	const uses: AutomationReferenceUse[] = [];

	// The channel or device reference held in the same object as a property reference
	const sibling = (
		kind: 'channel' | 'device',
		parent: AutomationConfigPath,
	): { id: string; path: AutomationConfigPath } | undefined => {
		const reference = references.find(
			(candidate) =>
				candidate.kind === kind &&
				candidate.path !== null &&
				candidate.path.length === parent.length + 1 &&
				samePath(candidate.path.slice(0, -1), parent),
		);

		return reference && reference.path ? { id: reference.id, path: reference.path } : undefined;
	};

	for (const reference of references) {
		if (reference.kind !== 'property' || reference.path === null) continue;

		const parent = reference.path.slice(0, -1);
		const channel = sibling('channel', parent);
		const device = sibling('device', parent);

		if (channel) consumed.push(channel.path);
		if (device) consumed.push(device.path);

		uses.push({
			kind: 'property',
			id: reference.id,
			nodeId: node.id,
			path: reference.path,
			...(channel || device ? { target: { ...(channel ? { channel } : {}), ...(device ? { device } : {}) } } : {}),
		});
	}

	for (const reference of references) {
		if (reference.kind === 'property' && reference.path !== null) continue;

		const path = reference.path;

		if (path !== null && consumed.some((taken) => samePath(taken, path))) continue;

		uses.push({ kind: reference.kind, id: reference.id, nodeId: node.id, path });
	}

	return uses;
};

/** Every reference of the automation: its space and what each node refers to, in the order of the nodes */
export const collectReferenceUses = (
	graph: AutomationReferenceGraph,
	lookup: AutomationNodeTypeLookup,
	spaceId: string | null,
): AutomationReferenceUse[] => {
	const uses: AutomationReferenceUse[] = [];

	if (spaceId !== null) {
		uses.push({ kind: 'space', id: spaceId, nodeId: null, path: [AUTOMATION_SPACE_FIELD] });
	}

	for (const node of graph.nodes) {
		uses.push(...usesOfNode(lookup, node));
	}

	return uses;
};

/** The references that do not exist, each with every place it is used, in the order they are first used */
export const findMissingReferences = async (
	uses: AutomationReferenceUse[],
	lookup: AutomationReferenceLookup,
): Promise<AutomationMissingReference[]> => {
	const known = new Map<string, Promise<boolean>>();

	const check = (key: string, ask: () => Promise<boolean>): Promise<boolean> => {
		const cached = known.get(key);

		if (cached !== undefined) return cached;

		const answer = ask();

		known.set(key, answer);

		return answer;
	};

	const missing = new Map<string, AutomationMissingReference>();

	for (const use of uses) {
		const channelId = use.target?.channel?.id;
		const deviceId = use.target?.device?.id;

		const exists =
			use.kind === 'property'
				? await check(`property:${use.id}:${channelId ?? ''}:${deviceId ?? ''}`, () =>
						lookup.propertyTargetExists(use.id, channelId, deviceId),
					)
				: await check(`${use.kind}:${use.id}`, () => lookup.exists(use.kind, use.id));

		if (exists) continue;

		const key = `${use.kind}:${use.id}`;
		const entry = missing.get(key) ?? { kind: use.kind, id: use.id, usages: [], remappable: true };

		entry.usages.push({
			nodeId: use.nodeId,
			field: use.nodeId === null ? AUTOMATION_SPACE_FIELD : use.path !== null ? formatConfigPath(use.path) : null,
		});
		entry.remappable = entry.remappable && use.path !== null;

		missing.set(key, entry);
	}

	return [...missing.values()];
};

/**
 * Points references at other entities in a copy of the graph. Only the field each use is held in is rewritten;
 * a use in an unknown field is left as it is. A property target gets the channel and device of the new property
 * as well. Returns the space the automation then belongs to.
 */
export const applyReferenceMappings = <TGraph extends AutomationReferenceGraph>(
	graph: TGraph,
	spaceId: string | null,
	uses: AutomationReferenceUse[],
	mappings: AutomationResolvedReferenceMapping[],
): { graph: TGraph; spaceId: string | null } => {
	// A JSON copy, not structuredClone(): the graph is a JSON document, and the response serialiser keeps the keys
	// of plain objects only - a clone made in another realm (a test runner's) would not count as one
	const next = JSON.parse(JSON.stringify(graph)) as TGraph;
	const nodes = new Map(next.nodes.map((node) => [node.id, node]));

	let space = spaceId;

	for (const use of uses) {
		const mapping = mappings.find((item) => item.kind === use.kind && item.id === use.id);

		if (!mapping) continue;

		if (use.nodeId === null) {
			space = mapping.to;

			continue;
		}

		const node = nodes.get(use.nodeId);

		if (!node || !isRecord(node.config) || use.path === null) continue;

		setAt(node.config, use.path, mapping.to);

		if (use.target?.channel && mapping.channelId !== undefined) {
			setAt(node.config, use.target.channel.path, mapping.channelId);
		}

		if (use.target?.device && mapping.deviceId !== undefined) {
			setAt(node.config, use.target.device.path, mapping.deviceId);
		}
	}

	return { graph: next, spaceId: space };
};
