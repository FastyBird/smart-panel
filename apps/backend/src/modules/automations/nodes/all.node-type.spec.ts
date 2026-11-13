import { normalizeAutomationNodeType } from '../graph/node-type';

import { ALL_NODE_TYPE, allNodeType } from './all.node-type';

describe('allNodeType', () => {
	it('is a flow block with one input taking many edges and one output that the engine runs as All', () => {
		expect(normalizeAutomationNodeType(allNodeType)).toMatchObject({
			type: ALL_NODE_TYPE,
			kind: 'flow',
			ports: { inputs: ['in'], outputs: ['out'] },
		});
		expect(allNodeType.flow).toBe('all');
	});

	it('has nothing to configure', async () => {
		expect(await allNodeType.validateConfig({})).toEqual([]);
		expect(await allNodeType.validateConfig({ within_seconds: 30 })).toEqual([
			{ field: 'within_seconds', reason: 'This property is not allowed.' },
		]);
	});
});
