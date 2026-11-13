import { normalizeAutomationNodeType } from '../graph/node-type';

import { ANY_NODE_TYPE, anyNodeType } from './any.node-type';

describe('anyNodeType', () => {
	it('is a flow block with one input taking many edges and one output that the engine runs as Any', () => {
		expect(normalizeAutomationNodeType(anyNodeType)).toMatchObject({
			type: ANY_NODE_TYPE,
			kind: 'flow',
			ports: { inputs: ['in'], outputs: ['out'] },
		});
		expect(anyNodeType.flow).toBe('any');
	});

	it('has nothing to configure', async () => {
		expect(await anyNodeType.validateConfig({})).toEqual([]);
		expect(await anyNodeType.validateConfig({ count: 2 })).toEqual([
			{ field: 'count', reason: 'This property is not allowed.' },
		]);
		expect(anyNodeType.configSchema).toEqual({ type: 'object', properties: {}, additionalProperties: false });
	});
});
