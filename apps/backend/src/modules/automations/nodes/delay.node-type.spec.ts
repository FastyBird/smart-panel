import { AUTOMATION_DELAY_MAX_SECONDS, normalizeAutomationNodeType } from '../graph/node-type';

import { DELAY_NODE_TYPE, delayNodeType } from './delay.node-type';

describe('delayNodeType', () => {
	it('is a flow block with one input and one output that the engine runs as a delay', () => {
		expect(normalizeAutomationNodeType(delayNodeType)).toMatchObject({
			type: DELAY_NODE_TYPE,
			kind: 'flow',
			ports: { inputs: ['in'], outputs: ['out'] },
		});
		expect(delayNodeType.flow).toBe('delay');
		expect(delayNodeType.delaySeconds({ seconds: 90 })).toBe(90);
	});

	it('accepts a whole number of seconds up to one hour', async () => {
		expect(AUTOMATION_DELAY_MAX_SECONDS).toBe(3600);
		expect(await delayNodeType.validateConfig({ seconds: 1 })).toEqual([]);
		expect(await delayNodeType.validateConfig({ seconds: 3600 })).toEqual([]);
	});

	it.each([
		['more than one hour', { seconds: 3601 }, 'The delay must be at most 3600 seconds (1 hour).'],
		['zero', { seconds: 0 }, 'The delay must be at least 1 second.'],
		['a fraction', { seconds: 1.5 }, 'The delay must be a whole number of seconds.'],
	])('refuses %s', async (_name, config, reason) => {
		expect(await delayNodeType.validateConfig(config)).toEqual([{ field: 'seconds', reason }]);
	});

	it('refuses a missing duration and unknown properties', async () => {
		expect((await delayNodeType.validateConfig({})).map((problem) => problem.field)).toContain('seconds');
		expect(await delayNodeType.validateConfig({ seconds: 5, minutes: 1 })).toEqual([
			{ field: 'minutes', reason: 'This property is not allowed.' },
		]);
	});

	it('describes its configuration for a generic form', () => {
		expect(delayNodeType.configSchema).toMatchObject({
			properties: { seconds: { type: 'integer', minimum: 1, maximum: 3600 } },
			required: ['seconds'],
		});
	});
});
