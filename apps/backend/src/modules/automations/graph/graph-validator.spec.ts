import { ALL_NODE_TYPE, allNodeType } from '../nodes/all.node-type';
import { ANY_NODE_TYPE, anyNodeType } from '../nodes/any.node-type';
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

	describe('safety_reducing_action', () => {
		const drawn = graph(
			[node('t', FAKE_TRIGGER_TYPE), node('c', FAKE_CONDITION_TYPE), node('a', FAKE_ACTION_TYPE, { level: 1 })],
			[e('t:out>c:in'), e('c:yes>a:in')],
		);

		it('asks the safety check for every action node, and for no other kind', async () => {
			const asked: string[] = [];

			const issues = await validateGraph(drawn, lookup, {
				safety: (nodeType, config) => {
					asked.push(`${nodeType.type} ${JSON.stringify(config)}`);

					return [];
				},
			});

			expect(asked).toEqual([`${FAKE_ACTION_TYPE} {"level":1}`]);
			expect(issues).toEqual([]);
		});

		it('reports what the check finds on the node, as an error or as a warning', async () => {
			const issues = await validateGraph(drawn, lookup, {
				safety: () => [
					{ severity: 'error', message: 'An automation can not unlock a lock.', field: 'writes.0.value' },
					{ severity: 'warning', message: 'The scene was not run.' },
				],
			});

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'safety_reducing_action',
					message: 'An automation can not unlock a lock.',
					node_id: 'a',
					field: 'writes.0.value',
				},
				{ severity: 'warning', code: 'safety_reducing_action', message: 'The scene was not run.', node_id: 'a' },
			]);
		});

		it('does not let through what could not be checked', async () => {
			const thrown = await validateGraph(drawn, lookup, {
				safety: () => Promise.reject(new Error('database is locked')),
			});

			expect(thrown).toEqual([
				{
					severity: 'error',
					code: 'safety_reducing_action',
					message: 'The safety of this action could not be checked.',
					node_id: 'a',
				},
			]);

			const garbage = await validateGraph(drawn, lookup, {
				safety: () => [null] as never,
			});

			expect(garbage).toEqual([expect.objectContaining({ severity: 'error', code: 'safety_reducing_action' })]);
		});

		it('is reported next to an invalid configuration, and not asked when the configuration is not an object', async () => {
			const safety = jest.fn(() => [{ severity: 'error' as const, message: 'Not safe.' }]);

			const invalid = await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_STRICT_ACTION_TYPE, { level: 250 })], [e('t:out>a:in')]),
				lookup,
				{ safety },
			);

			expect(codes(invalid)).toEqual(['invalid_config', 'safety_reducing_action']);

			safety.mockClear();

			await validateGraph(
				graph([node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_ACTION_TYPE, 'nothing')], [e('t:out>a:in')]),
				lookup,
				{ safety },
			);

			expect(safety).not.toHaveBeenCalled();
		});

		it('is not looked for when no check is given', async () => {
			expect(await validateGraph(drawn, lookup)).toEqual([]);
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
	describe('All fed from triggers', () => {
		const joinLookup = createLookup([...FAKE_NODE_TYPES, anyNodeType, allNodeType]);

		it('is an error when no single trigger leads to every input: the All can never continue', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t1', FAKE_TRIGGER_TYPE),
						node('t2', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
						node('on', FAKE_ACTION_TYPE),
					],
					[e('t1:out>a:in'), e('a:done>all:in'), e('t2:out>all:in'), e('all:out>on:in')],
				),
				joinLookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'join_never_completes',
					message:
						'This All can never continue: no run brings a token to every one of its inputs. A run starts from one trigger and a block takes one output each time it runs; to combine two events, use Wait until.',
					node_id: 'all',
				},
			]);
		});

		it('is a warning naming the triggers whose runs stop at the All when only some can complete it', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t1', FAKE_TRIGGER_TYPE),
						node('t2', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[e('t1:out>a:in'), e('t1:out>b:in'), e('t2:out>b:in'), e('a:done>all:in'), e('b:done>all:in')],
				),
				joinLookup,
			);

			expect(issues).toEqual([
				{
					severity: 'warning',
					code: 'join_partly_completes',
					message:
						'This All continues only in runs of some of the triggers that lead to it; a run of 1 other trigger(s) stops here.',
					node_id: 'all',
					node_ids: ['t2'],
				},
			]);
		});

		it('finds nothing when every trigger leading to the All leads to all of its inputs', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t1', FAKE_TRIGGER_TYPE),
						node('t2', FAKE_TRIGGER_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[
						e('t1:out>c:in'),
						e('t2:out>c:in'),
						e('c:yes>a:in'),
						e('c:yes>b:in'),
						e('a:done>all:in'),
						e('b:done>all:in'),
					],
				),
				joinLookup,
			);

			expect(issues).toEqual([]);
		});

		it('is an error when two inputs come from different outputs of a block that runs once in a run', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[e('t:out>c:in'), e('c:yes>a:in'), e('a:done>all:in'), e('c:no>all:in')],
				),
				joinLookup,
			);

			expect(issues).toEqual([
				{
					severity: 'error',
					code: 'join_never_completes',
					message:
						'This All can never continue: no run brings a token to every one of its inputs. A run starts from one trigger and a block takes one output each time it runs; to combine two events, use Wait until.',
					node_id: 'all',
				},
			]);
		});

		it('sees through a join: what follows an Any runs once in a run', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('x', FAKE_ACTION_TYPE),
						node('y', FAKE_ACTION_TYPE),
						node('any', ANY_NODE_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[
						e('t:out>x:in'),
						e('t:out>y:in'),
						e('x:done>any:in'),
						e('y:done>any:in'),
						e('any:out>c:in'),
						e('c:yes>all:in'),
						e('c:no>all:in'),
					],
				),
				joinLookup,
			);

			expect(codes(issues)).toEqual(['join_never_completes']);
		});

		it('says nothing when the block may run more than once in a run, so it can take both outputs', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('x', FAKE_ACTION_TYPE),
						node('y', FAKE_ACTION_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[e('t:out>x:in'), e('t:out>y:in'), e('x:done>c:in'), e('y:done>c:in'), e('c:yes>all:in'), e('c:no>all:in')],
				),
				joinLookup,
			);

			expect(issues).toEqual([]);
		});

		it('carries what an upstream All can pass on: a chained All no trigger can complete is an error', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t1', FAKE_TRIGGER_TYPE),
						node('t2', FAKE_TRIGGER_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('A', ALL_NODE_TYPE),
						node('B', ALL_NODE_TYPE),
					],
					[e('t1:out>A:in'), e('t1:out>b:in'), e('t2:out>b:in'), e('b:done>A:in'), e('A:out>B:in'), e('t2:out>B:in')],
				),
				joinLookup,
			);

			expect(issues.map((issue) => [issue.severity, issue.code, issue.node_id])).toEqual([
				['warning', 'join_partly_completes', 'A'],
				['error', 'join_never_completes', 'B'],
			]);
		});

		it('finds nothing in chained Alls every trigger can complete', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('a', FAKE_ACTION_TYPE),
						node('b', FAKE_ACTION_TYPE),
						node('c', FAKE_ACTION_TYPE),
						node('A', ALL_NODE_TYPE),
						node('B', ALL_NODE_TYPE),
					],
					[
						e('t:out>a:in'),
						e('t:out>b:in'),
						e('t:out>c:in'),
						e('a:done>A:in'),
						e('b:done>A:in'),
						e('A:out>B:in'),
						e('c:done>B:in'),
					],
				),
				joinLookup,
			);

			expect(issues).toEqual([]);
		});

		it('keeps the output of a block that runs once through a join with a single input', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('any', ANY_NODE_TYPE),
						node('all', ALL_NODE_TYPE),
					],
					[e('t:out>c:in'), e('c:yes>any:in'), e('any:out>all:in'), e('c:no>all:in')],
				),
				joinLookup,
			);

			expect(codes(issues)).toEqual(['join_never_completes']);
		});

		it('sees a choice made before an All that has several inputs', async () => {
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('c', FAKE_CONDITION_TYPE),
						node('x', FAKE_ACTION_TYPE),
						node('y', FAKE_ACTION_TYPE),
						node('A', ALL_NODE_TYPE),
						node('B', ALL_NODE_TYPE),
					],
					[
						e('t:out>c:in'),
						e('c:yes>x:in'),
						e('c:yes>y:in'),
						e('x:done>A:in'),
						e('y:done>A:in'),
						e('A:out>B:in'),
						e('c:no>B:in'),
					],
				),
				joinLookup,
			);

			expect(issues.map((issue) => [issue.code, issue.node_id])).toEqual([['join_never_completes', 'B']]);
		});

		describe('both outputs of one Wait until', () => {
			const waitUntil = normalizeAutomationNodeType({
				type: 'test.wait',
				kind: 'flow',
				name: 'Test wait',
				description: 'Takes out or timeout.',
				ports: { inputs: ['in'], outputs: ['out', 'timeout'] },
				validateConfig: () => [],
			});
			const waitLookup: AutomationNodeTypeLookup = (type) => (type === 'test.wait' ? waitUntil : joinLookup(type));

			it('is an error when every run reaches the Wait until once, whichever trigger started it', async () => {
				const issues = await validateGraph(
					graph(
						[
							node('t1', FAKE_TRIGGER_TYPE),
							node('t2', FAKE_TRIGGER_TYPE),
							node('wait', 'test.wait'),
							node('all', ALL_NODE_TYPE),
						],
						[e('t1:out>wait:in'), e('t2:out>wait:in'), e('wait:out>all:in'), e('wait:timeout>all:in')],
					),
					waitLookup,
				);

				expect(codes(issues)).toEqual(['join_never_completes']);
			});

			it('is fine when one run reaches the Wait until along two paths, so both outputs can be taken', async () => {
				const issues = await validateGraph(
					graph(
						[
							node('t', FAKE_TRIGGER_TYPE),
							node('p', FAKE_ACTION_TYPE),
							node('q', FAKE_ACTION_TYPE),
							node('wait', 'test.wait'),
							node('all', ALL_NODE_TYPE),
						],
						[
							e('t:out>p:in'),
							e('t:out>q:in'),
							e('p:done>wait:in'),
							e('q:done>wait:in'),
							e('wait:out>all:in'),
							e('wait:timeout>all:in'),
						],
					),
					waitLookup,
				);

				expect(issues).toEqual([]);
			});
		});

		it('refuses nothing when a run has too many combinations of outputs to try', async () => {
			const conditions = Array.from({ length: 12 }, (_value, index) => `c${index}`);
			const issues = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('sink', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
						...conditions.map((id) => node(id, FAKE_CONDITION_TYPE)),
					],
					[
						...conditions.flatMap((id) => [e(`t:out>${id}:in`), e(`${id}:yes>sink:in`), e(`${id}:no>sink:in`)]),
						e('c0:yes>all:in'),
						e('c0:no>all:in'),
					],
				),
				joinLookup,
			);

			// 2^12 combinations are tried and none completes the All; one condition more would be too many
			expect(codes(issues)).toEqual(['join_never_completes']);

			const more = await validateGraph(
				graph(
					[
						node('t', FAKE_TRIGGER_TYPE),
						node('sink', FAKE_ACTION_TYPE),
						node('all', ALL_NODE_TYPE),
						...[...conditions, 'c12'].map((id) => node(id, FAKE_CONDITION_TYPE)),
					],
					[
						...[...conditions, 'c12'].flatMap((id) => [
							e(`t:out>${id}:in`),
							e(`${id}:yes>sink:in`),
							e(`${id}:no>sink:in`),
						]),
						e('c0:yes>all:in'),
						e('c0:no>all:in'),
					],
				),
				joinLookup,
			);

			expect(more).toEqual([]);
		});

		it('lets an Any combine two triggers', async () => {
			const issues = await validateGraph(
				graph(
					[node('t1', FAKE_TRIGGER_TYPE), node('t2', FAKE_TRIGGER_TYPE), node('any', ANY_NODE_TYPE)],
					[e('t1:out>any:in'), e('t2:out>any:in')],
				),
				joinLookup,
			);

			expect(issues).toEqual([]);
		});

		it('leaves an input no trigger leads to to the unreachable warning', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('orphan', FAKE_ACTION_TYPE), node('all', ALL_NODE_TYPE)],
					[e('t:out>all:in'), e('orphan:done>all:in')],
				),
				joinLookup,
			);

			expect(codes(issues)).toEqual(['unreachable_node']);
		});

		it('says nothing while a node of an unknown type could be a trigger', async () => {
			const issues = await validateGraph(
				graph(
					[node('t', FAKE_TRIGGER_TYPE), node('x', 'not.registered'), node('all', ALL_NODE_TYPE)],
					[e('t:out>all:in'), e('x:out>all:in')],
				),
				joinLookup,
			);

			expect(codes(issues)).toEqual(['unknown_node_type']);
		});
	});
});
