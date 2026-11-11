import {
	FAKE_ACTION_TYPE,
	FAKE_CONDITION_TYPE,
	FAKE_JOIN_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../testing/fake-node-types';

import { AUTOMATION_GRAPH_MAX_CONFIG_ISSUES_PER_NODE, AutomationGraphIssue, validateGraph } from './graph-validator';
import {
	AutomationNodeType,
	AutomationNodeTypeLookup,
	RegisteredAutomationNodeType,
	normalizeAutomationNodeType,
} from './node-type';

const createLookup = (nodeTypes: AutomationNodeType<any>[]): AutomationNodeTypeLookup => {
	const registered = new Map<string, RegisteredAutomationNodeType>(
		nodeTypes.map((nodeType) => [nodeType.type, normalizeAutomationNodeType(nodeType)]),
	);

	return (type) => registered.get(type);
};

const lookup = createLookup(FAKE_NODE_TYPES);

const node = (id: string, type: string, config: unknown = {}) => ({ id, type, position: { x: 0, y: 0 }, config });

/** `e('t:out>a:in')` is an edge from port `out` of node `t` to port `in` of node `a`, with that text as its id */
const e = (spec: string) => {
	const [from, to] = spec.split('>');
	const [source, source_port] = from.split(':');
	const [target, target_port] = to.split(':');

	return { id: spec, source, source_port, target, target_port };
};

const graph = (nodes: unknown[], edges: unknown[] = []) => ({ version: 1, nodes, edges });

const codes = (issues: AutomationGraphIssue[]) => issues.map((issue) => issue.code);

describe('validateGraph', () => {
	it('finds nothing in a complete graph that uses every kind of node', async () => {
		const issues = await validateGraph(
			graph(
				[
					node('t', FAKE_TRIGGER_TYPE),
					node('c', FAKE_CONDITION_TYPE),
					node('a', FAKE_ACTION_TYPE),
					node('b', FAKE_STRICT_ACTION_TYPE, { level: 40 }),
					node('j', FAKE_JOIN_TYPE),
				],
				[e('t:out>c:in'), e('c:yes>a:in'), e('c:no>b:in'), e('a:done>j:a'), e('b:done>j:b'), e('b:error>j:a')],
			),
			lookup,
		);

		expect(issues).toEqual([]);
	});

	it('lets two edges lead into the same port of a node', async () => {
		const issues = await validateGraph(
			graph(
				[node('t1', FAKE_TRIGGER_TYPE), node('t2', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)],
				[e('t1:out>a:in'), e('t2:out>a:in')],
			),
			lookup,
		);

		expect(issues).toEqual([]);
	});

	describe('unknown_node_type', () => {
		it('is an error on the node', async () => {
			const issues = await validateGraph(graph([node('t', FAKE_TRIGGER_TYPE), node('x', 'not.registered')]), lookup);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'unknown_node_type',
					message: 'Node type "not.registered" is not available.',
					node_id: 'x',
				},
			]);
		});

		it('does not check the ports of edges at a node of an unknown type', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('x', 'not.registered'), node('a', FAKE_ACTION_TYPE)],
					[e('t:out>x:anything'), e('x:whatever>a:in')],
				),
				lookup,
			);

			expect(codes(issues)).toEqual(['unknown_node_type']);
		});

		it('says neither that the trigger is missing nor that nodes are unreachable, as the unknown node may be the trigger', async () => {
			const issues = await validateGraph(
				graph([node('x', 'not.registered'), node('a', FAKE_ACTION_TYPE)], [e('x:out>a:in')]),
				lookup,
			);

			expect(codes(issues)).toEqual(['unknown_node_type']);
		});

		it('shortens an overlong type in the message', async () => {
			const [issue] = await validateGraph(graph([node('x', 'x'.repeat(5000))]), lookup);

			expect(issue.message.length).toBeLessThan(200);
		});
	});

	describe('invalid_config', () => {
		it('is an error on the node for each reason, naming the field', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_STRICT_ACTION_TYPE, { level: 250, extra: 'secret-value' })],
					[e('t:out>a:in')],
				),
				lookup,
			);

			expect(issues).toEqual(
				expect.arrayContaining([
					{
						severity: 'error',
						code: 'invalid_config',
						message: 'Level must be between 0 and 100.',
						node_id: 'a',
						field: 'level',
					},
					{
						severity: 'error',
						code: 'invalid_config',
						message: 'This property is not allowed.',
						node_id: 'a',
						field: 'extra',
					},
				]),
			);
			expect(issues).toHaveLength(2);
		});

		it('does not repeat submitted values in its reasons', async () => {
			const issues = await validateGraph(
				graph([
					node('t', FAKE_TRIGGER_TYPE),
					node('a', FAKE_STRICT_ACTION_TYPE, { level: 'secret-value', scene_id: 7 }),
				]),
				lookup,
			);

			expect(codes(issues)).toContain('invalid_config');
			expect(JSON.stringify(issues)).not.toContain('secret-value');
		});

		it('is reported for a configuration that is not an object, without calling the node type', async () => {
			const validateConfig = jest.fn(() => []);
			const strict = createLookup([{ ...FAKE_NODE_TYPES[0], validateConfig }]);

			for (const config of ['on', null, undefined, 7, ['a']]) {
				const issues = await validateGraph(graph([{ id: 't', type: FAKE_TRIGGER_TYPE, config }]), strict);

				expect(issues).toEqual([
					{ severity: 'error', code: 'invalid_config', message: 'The configuration must be an object.', node_id: 't' },
				]);
			}

			expect(validateConfig).not.toHaveBeenCalled();
		});

		it('is reported without the cause when the node type throws', async () => {
			const throwing = createLookup([
				{
					...FAKE_NODE_TYPES[0],
					validateConfig: () => {
						throw new Error('secret-value is wrong');
					},
				},
			]);

			const issues = await validateGraph(graph([node('t', FAKE_TRIGGER_TYPE)]), throwing);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'invalid_config',
					message: 'The configuration could not be validated.',
					node_id: 't',
				},
			]);
		});

		it('survives a node type that returns something other than a list of reasons', async () => {
			const odd = createLookup([
				{ ...FAKE_NODE_TYPES[0], validateConfig: () => ['just text', null] as never },
				{ ...FAKE_NODE_TYPES[2], validateConfig: () => 'no' as never },
			]);

			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)], [e('t:out>a:in')]),
				odd,
			);

			expect(issues.map((issue) => [issue.node_id, issue.message])).toEqual([
				['t', 'The configuration is not valid.'],
				['t', 'The configuration is not valid.'],
			]);
		});

		it('reports a bounded number of reasons for one node', async () => {
			const noisy = createLookup([
				{
					...FAKE_NODE_TYPES[0],
					validateConfig: () => Array.from({ length: 500 }, (_, index) => ({ reason: `Reason ${index}` })),
				},
			]);

			const issues = await validateGraph(graph([node('t', FAKE_TRIGGER_TYPE)]), noisy);

			expect(issues).toHaveLength(AUTOMATION_GRAPH_MAX_CONFIG_ISSUES_PER_NODE);
		});
	});

	describe('unknown_port', () => {
		it('is an error on the source node for an output port the node type does not have', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)], [e('t:yes>a:in')]),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'unknown_port',
					message: 'Node type "test.trigger" has no output port "yes".',
					node_id: 't',
					edge_id: 't:yes>a:in',
				},
			]);
		});

		it('is an error on the target node for an input port the node type does not have', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('j', FAKE_JOIN_TYPE)], [e('t:out>j:in')]),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'unknown_port',
					message: 'Node type "test.join" has no input port "in".',
					node_id: 'j',
					edge_id: 't:out>j:in',
				},
			]);
		});

		it('is reported for both ends of one edge', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)], [e('t:in>a:out')]),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_id])).toEqual([
				['unknown_port', 't'],
				['unknown_port', 'a'],
			]);
		});

		it('does not take an input port for an output port', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE), node('b', FAKE_ACTION_TYPE)],
					[e('t:out>a:in'), e('a:in>b:in')],
				),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_id])).toEqual([['unknown_port', 'a']]);
		});
	});

	describe('edge_into_trigger', () => {
		it('is an error with its own code, not an unknown port', async () => {
			const issues = await validateGraph(
				graph([node('t1', FAKE_TRIGGER_TYPE), node('t2', FAKE_TRIGGER_TYPE)], [e('t1:out>t2:in')]),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'edge_into_trigger',
					message: 'A trigger starts a run, so no edge can lead into it.',
					node_id: 't2',
					edge_id: 't1:out>t2:in',
				},
			]);
		});
	});

	describe('cycle', () => {
		it('is an error reported once, with the nodes taking part in graph order', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('c', FAKE_ACTION_TYPE),
						node('d', FAKE_ACTION_TYPE),
					],
					[e('t:out>a:in'), e('a:done>b:in'), e('b:done>c:in'), e('c:done>a:in'), e('c:error>d:in')],
				),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'cycle',
					message: 'The graph must not loop back on itself; 3 node(s) form a cycle.',
					node_ids: ['a', 'b', 'c'],
				},
			]);
		});

		it('reports a node wired to itself', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)], [e('t:out>a:in'), e('a:done>a:in')]),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_ids])).toEqual([['cycle', ['a']]]);
		});

		it('reports separate cycles separately and interlocked cycles as one', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('c', FAKE_ACTION_TYPE),
						node('x', FAKE_ACTION_TYPE),
						node('y', FAKE_ACTION_TYPE),
					],
					[
						e('t:out>a:in'),
						// a → b → a and b → c → b share b: one group
						e('a:done>b:in'),
						e('b:done>a:in'),
						e('b:error>c:in'),
						e('c:done>b:in'),
						// x → y → x is apart from it
						e('a:error>x:in'),
						e('x:done>y:in'),
						e('y:done>x:in'),
					],
				),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_ids])).toEqual([
				['cycle', ['a', 'b', 'c']],
				['cycle', ['x', 'y']],
			]);
		});

		it('does not take a diamond for a cycle', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('z', FAKE_ACTION_TYPE),
					],
					[e('t:out>c:in'), e('c:yes>a:in'), e('c:no>b:in'), e('a:done>z:in'), e('b:done>z:in')],
				),
				lookup,
			);

			expect(issues).toEqual([]);
		});

		it('is found in a chain far deeper than the call stack would allow', async () => {
			const count = 20_000;
			const nodes = [
				node('t', FAKE_TRIGGER_TYPE),
				...Array.from({ length: count }, (_, i) => node(`a${i}`, FAKE_ACTION_TYPE)),
			];
			const edges = [
				e('t:out>a0:in'),
				...Array.from({ length: count - 1 }, (_, i) => e(`a${i}:done>a${i + 1}:in`)),
				e(`a${count - 1}:done>a0:in`),
			];

			const issues = await validateGraph(graph(nodes, edges), lookup);

			expect(codes(issues)).toEqual(['cycle']);
			expect(issues[0].node_ids).toHaveLength(count);
		});
	});

	describe('duplicate_edge', () => {
		it('is an error on every edge that repeats an earlier one', async () => {
			const first = e('t:out>a:in');

			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)],
					[first, { ...first, id: 'again' }, { ...first, id: 'and-again' }],
				),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'duplicate_edge',
					message: 'Another edge already connects the same two ports.',
					edge_id: 'again',
				},
				{
					severity: 'error',
					code: 'duplicate_edge',
					message: 'Another edge already connects the same two ports.',
					edge_id: 'and-again',
				},
			]);
		});

		it('does not confuse edges that differ in one port', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('c', FAKE_CONDITION_TYPE), node('j', FAKE_JOIN_TYPE)],
					[e('t:out>c:in'), e('c:yes>j:a'), e('c:no>j:a'), e('c:yes>j:b')],
				),
				lookup,
			);

			expect(issues).toEqual([]);
		});
	});

	describe('no_trigger', () => {
		it('is an error on the graph when it is empty', async () => {
			expect(await validateGraph(graph([]), lookup)).toEqual([
				{ severity: 'error', code: 'no_trigger', message: 'An automation needs at least one trigger to start it.' },
			]);
		});

		it('is reported next to the unreachable nodes when no node is a trigger', async () => {
			const issues = await validateGraph(
				graph([node('c', FAKE_CONDITION_TYPE), node('a', FAKE_ACTION_TYPE)], [e('c:yes>a:in')]),
				lookup,
			);

			expect(issues.map((issue) => [issue.severity, issue.code, issue.node_id])).toEqual([
				['error', 'no_trigger', undefined],
				['warning', 'unreachable_node', 'c'],
				['warning', 'unreachable_node', 'a'],
			]);
		});
	});

	describe('unreachable_node', () => {
		it('is a warning on every node no trigger leads to', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('orphan', FAKE_ACTION_TYPE),
						node('behind', FAKE_ACTION_TYPE),
					],
					[e('t:out>a:in'), e('orphan:done>behind:in')],
				),
				lookup,
			);

			expect(issues).toEqual([
				{
					severity: 'warning',
					code: 'unreachable_node',
					message: 'No trigger leads to this node, so it never runs.',
					node_id: 'orphan',
				},
				{
					severity: 'warning',
					code: 'unreachable_node',
					message: 'No trigger leads to this node, so it never runs.',
					node_id: 'behind',
				},
			]);
		});

		it('is never said of a trigger', async () => {
			const issues = await validateGraph(graph([node('t1', FAKE_TRIGGER_TYPE), node('t2', FAKE_TRIGGER_TYPE)]), lookup);

			expect(issues).toEqual([]);
		});
	});

	describe('graphs that break the shape rules', () => {
		it.each([
			['nothing', undefined],
			['null', null],
			['text', 'graph'],
			['a list', []],
			['an object without nodes and edges', {}],
			['nodes and edges that are not lists', { version: 1, nodes: 'n', edges: { a: 1 } }],
		])('treats %s as an empty graph', async (_label, input) => {
			expect(codes(await validateGraph(input, lookup))).toEqual(['no_trigger']);
		});

		it('skips nodes and edges it cannot read', async () => {
			const issues = await validateGraph(
				graph(
					[
						null,
						'node',
						7,
						{ type: FAKE_ACTION_TYPE },
						{ id: 9, type: FAKE_ACTION_TYPE },
						node('t', FAKE_TRIGGER_TYPE),
					],
					[null, 'edge', {}, { id: 'e', source: 7, target: 't' }],
				),
				lookup,
			);

			expect(issues).toEqual([]);
		});

		it('ignores dangling edges', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE)], [e('t:out>ghost:in'), e('ghost:out>t:in'), e('t:nope>ghost:in')]),
				lookup,
			);

			expect(issues).toEqual([]);
		});

		it('checks ports that are not strings and edges without an id', async () => {
			const issues = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE)], [{ source: 't', target: 'a' }]),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_id, issue.edge_id, issue.message])).toEqual([
				['unknown_port', 't', undefined, 'Node type "test.trigger" has no output port (not a string).'],
				['unknown_port', 'a', undefined, 'Node type "test.action" has no input port (not a string).'],
			]);
		});

		it('checks every node sharing an identifier and resolves edges to the first of them', async () => {
			const issues = await validateGraph(
				graph(
					[node('n', FAKE_TRIGGER_TYPE), node('n', 'not.registered'), node('a', FAKE_ACTION_TYPE)],
					[e('n:out>a:in')],
				),
				lookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_id])).toEqual([['unknown_node_type', 'n']]);
		});

		it('treats a type that is not a string as unknown and survives a lookup that throws', async () => {
			const issues = await validateGraph(graph([{ id: 'x', type: { a: 1 }, config: {} }, node('y', 'boom')]), () => {
				throw new Error('boom');
			});

			expect(issues.map((issue) => [issue.code, issue.node_id, issue.message])).toEqual([
				['unknown_node_type', 'x', 'Node type (not a string) is not available.'],
				['unknown_node_type', 'y', 'Node type "boom" is not available.'],
			]);
		});
	});
});
