import { normalizeAutomationNodeType } from '../graph/node-type';

import { MANUAL_START_NODE_TYPE, manualStartNodeType } from './manual-start.node-type';

describe('manual.start', () => {
	it('is a trigger with one output and nothing to configure', async () => {
		expect(normalizeAutomationNodeType(manualStartNodeType)).toMatchObject({
			type: MANUAL_START_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
			configSchema: { type: 'object', properties: {}, additionalProperties: false },
		});
		expect(await manualStartNodeType.validateConfig({})).toEqual([]);
	});

	it('refuses any configuration', async () => {
		expect(await manualStartNodeType.validateConfig({ label: 'Run' })).toEqual([
			{ field: 'label', reason: 'This property is not allowed.' },
		]);
	});

	it('never fires on its own, and can be released', () => {
		const fire = jest.fn();
		const release = manualStartNodeType.subscribe({}, fire);

		expect(typeof release).toBe('function');

		release();

		expect(fire).not.toHaveBeenCalled();
	});
});
