import {
	AutomationNodeConfig,
	AutomationNodeReference,
	AutomationNodeTypeLookup,
	RegisteredAutomationNodeType,
	normalizeAutomationNodeType,
} from '../graph/node-type';
import { devicePropertyReferences } from '../nodes/device-property.utils';

import {
	AutomationReferenceLookup,
	AutomationReferenceUse,
	applyReferenceMappings,
	collectReferenceUses,
	findMissingReferences,
} from './import-references';

const D1 = 'd1000000-0000-4000-8000-000000000000';
const C1 = 'c1000000-0000-4000-8000-000000000000';
const P1 = 'f1000000-0000-4000-8000-000000000000';
const P2 = 'f2000000-0000-4000-8000-000000000000';
const D9 = 'd9000000-0000-4000-8000-000000000000';
const C9 = 'c9000000-0000-4000-8000-000000000000';
const P9 = 'f9000000-0000-4000-8000-000000000000';
const SCENE = '5ce00000-0000-4000-8000-000000000000';
const SPACE = '5ba00000-0000-4000-8000-000000000000';

const nodeType = (type: string, references: (config: AutomationNodeConfig) => AutomationNodeReference[]) =>
	normalizeAutomationNodeType({
		type,
		kind: 'action',
		name: type,
		description: type,
		validateConfig: () => [],
		references,
		execute: () => Promise.resolve({ success: true }),
	} as never);

const TYPES = new Map<string, RegisteredAutomationNodeType>([
	[
		'set',
		nodeType('set', (config) =>
			((config.writes as Record<string, unknown>[]) ?? []).flatMap((write, index) =>
				devicePropertyReferences(write, ['writes', index]),
			),
		),
	],
	['compare', nodeType('compare', (config) => devicePropertyReferences(config))],
	['device', nodeType('device', (config) => [{ kind: 'device', id: config.device_id as string, path: ['device_id'] }])],
	['scene', nodeType('scene', (config) => [{ kind: 'scene', id: config.scene_id as string, path: ['scene_id'] }])],
	// A card that does not say where it holds its scene, as one built against an older SDK
	['pathless', nodeType('pathless', (config) => [{ kind: 'scene', id: config.scene_id as string }])],
	// A card that names a path that does not hold the id
	['lying', nodeType('lying', (config) => [{ kind: 'scene', id: config.scene_id as string, path: ['elsewhere'] }])],
	[
		'broken',
		nodeType('broken', () => {
			throw new Error('no');
		}),
	],
]);

const lookup: AutomationNodeTypeLookup = (type) => TYPES.get(type);

const target = (device: string, channel: string, property: string) => ({
	device_id: device,
	channel_id: channel,
	property_id: property,
});

const GRAPH = {
	nodes: [
		{
			id: 'set',
			type: 'set',
			config: {
				writes: [
					{ ...target(D1, C1, P1), value: true },
					{ ...target(D1, C1, P2), value: 10 },
				],
			},
		},
		{ id: 'offline', type: 'device', config: { device_id: D1 } },
		{ id: 'scene', type: 'scene', config: { scene_id: SCENE } },
		{ id: 'odd', type: 'broken', config: { scene_id: SCENE } },
		{ id: 'unknown', type: 'not.registered', config: { scene_id: SCENE } },
	],
};

describe('import references', () => {
	it('finds where every reference is held; a property takes the channel and the device next to it along', () => {
		expect(collectReferenceUses(GRAPH, lookup, SPACE)).toEqual<AutomationReferenceUse[]>([
			{ kind: 'space', id: SPACE, nodeId: null, path: ['space_id'] },
			{
				kind: 'property',
				id: P1,
				nodeId: 'set',
				path: ['writes', 0, 'property_id'],
				target: {
					channel: { id: C1, path: ['writes', 0, 'channel_id'] },
					device: { id: D1, path: ['writes', 0, 'device_id'] },
				},
			},
			{
				kind: 'property',
				id: P2,
				nodeId: 'set',
				path: ['writes', 1, 'property_id'],
				target: {
					channel: { id: C1, path: ['writes', 1, 'channel_id'] },
					device: { id: D1, path: ['writes', 1, 'device_id'] },
				},
			},
			{ kind: 'device', id: D1, nodeId: 'offline', path: ['device_id'] },
			{ kind: 'scene', id: SCENE, nodeId: 'scene', path: ['scene_id'] },
		]);
	});

	it('lists each missing reference once with every place it is used, and asks about each only once', async () => {
		const exists = jest.fn((kind: string) => Promise.resolve(kind === 'scene'));
		const propertyTargetExists = jest.fn((property: string) => Promise.resolve(property === P2));

		const existence: AutomationReferenceLookup = { exists, propertyTargetExists };

		const graph = {
			nodes: [...GRAPH.nodes, { id: 'again', type: 'device', config: { device_id: D1 } }],
		};

		expect(await findMissingReferences(collectReferenceUses(graph, lookup, SPACE), existence)).toEqual([
			{ kind: 'space', id: SPACE, usages: [{ nodeId: null, field: 'space_id' }], remappable: true },
			{ kind: 'property', id: P1, usages: [{ nodeId: 'set', field: 'writes.0.property_id' }], remappable: true },
			{
				kind: 'device',
				id: D1,
				usages: [
					{ nodeId: 'offline', field: 'device_id' },
					{ nodeId: 'again', field: 'device_id' },
				],
				remappable: true,
			},
		]);

		expect(propertyTargetExists).toHaveBeenCalledWith(P1, C1, D1);
		expect(exists).toHaveBeenCalledTimes(3);
	});

	it('points a property at another one with its channel and device, everything else by id, in a copy', () => {
		const uses = collectReferenceUses(GRAPH, lookup, SPACE);

		const mapped = applyReferenceMappings(GRAPH, SPACE, uses, [
			{ kind: 'property', id: P1, to: P9, channelId: C9, deviceId: D9 },
			{ kind: 'device', id: D1, to: D9 },
			{ kind: 'space', id: SPACE, to: D9 },
		]);

		expect(mapped.spaceId).toBe(D9);
		expect(mapped.graph.nodes[0].config).toEqual({
			writes: [
				{ ...target(D9, C9, P9), value: true },
				{ ...target(D1, C1, P2), value: 10 },
			],
		});
		expect(mapped.graph.nodes[1].config).toEqual({ device_id: D9 });
		expect(mapped.graph.nodes[2].config).toEqual({ scene_id: SCENE });

		// The graph that was mapped is left as it was
		expect(GRAPH.nodes[0].config.writes?.[0]).toEqual({ ...target(D1, C1, P1), value: true });
	});

	it('rewrites only the fields the card names, never a value that merely equals an id', () => {
		// A comparison against a literal that happens to be the id of the property, and of its device
		const graph = {
			nodes: [{ id: 'cmp', type: 'compare', config: { ...target(D1, C1, P1), operator: 'eq', value: P1, other: D1 } }],
		};

		const uses = collectReferenceUses(graph, lookup, null);

		expect(uses).toEqual([
			{
				kind: 'property',
				id: P1,
				nodeId: 'cmp',
				path: ['property_id'],
				target: { channel: { id: C1, path: ['channel_id'] }, device: { id: D1, path: ['device_id'] } },
			},
		]);

		const mapped = applyReferenceMappings(graph, null, uses, [
			{ kind: 'property', id: P1, to: P9, channelId: C9, deviceId: D9 },
		]);

		expect(mapped.graph.nodes[0].config).toEqual({ ...target(D9, C9, P9), operator: 'eq', value: P1, other: D1 });
	});

	it('reports a reference held in a field the card does not name, but never rewrites it', async () => {
		const graph = {
			nodes: [
				{ id: 'old', type: 'pathless', config: { scene_id: SCENE } },
				{ id: 'wrong', type: 'lying', config: { scene_id: SCENE, elsewhere: 'x' } },
			],
		};

		const uses = collectReferenceUses(graph, lookup, null);

		expect(uses.map((use) => use.path)).toEqual([null, null]);

		const existence: AutomationReferenceLookup = {
			exists: () => Promise.resolve(false),
			propertyTargetExists: () => Promise.resolve(false),
		};

		expect(await findMissingReferences(uses, existence)).toEqual([
			{
				kind: 'scene',
				id: SCENE,
				usages: [
					{ nodeId: 'old', field: null },
					{ nodeId: 'wrong', field: null },
				],
				remappable: false,
			},
		]);

		const mapped = applyReferenceMappings(graph, null, uses, [{ kind: 'scene', id: SCENE, to: P9 }]);

		expect(mapped.graph).toEqual(graph);
	});
});
