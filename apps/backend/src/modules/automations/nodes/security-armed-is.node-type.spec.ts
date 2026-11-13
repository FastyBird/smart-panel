import { ArmedState } from '../../security/security.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { runContext } from '../testing/node-fixtures';

import { SECURITY_ARMED_IS_NODE_TYPE, createSecurityArmedIsNodeType } from './security-armed-is.node-type';

describe('security.armed.is', () => {
	let armedState: jest.Mock<Promise<string | null>, []>;

	const card = () => createSecurityArmedIsNodeType({ armedState });

	beforeEach(() => {
		armedState = jest.fn<Promise<string | null>, []>(() => Promise.resolve(ArmedState.ARMED_AWAY));
	});

	it('is a condition with a yes and a no output', () => {
		expect(normalizeAutomationNodeType(card())).toMatchObject({
			type: SECURITY_ARMED_IS_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		});
	});

	it('takes one or more armed states, each once', async () => {
		expect(await card().validateConfig({ states: [ArmedState.ARMED_AWAY, ArmedState.ARMED_NIGHT] })).toEqual([]);
		expect(await card().validateConfig({ states: [ArmedState.DISARMED] })).toEqual([]);

		for (const config of [{}, { states: [] }, { states: ['triggered'] }, { states: ['disarmed', 'disarmed'] }]) {
			expect((await card().validateConfig(config)).map((problem) => problem.field)).toEqual(['states']);
		}
	});

	it('answers yes when the armed state is one of the chosen states', async () => {
		expect(await card().evaluate({ states: [ArmedState.ARMED_AWAY] }, runContext())).toEqual({
			result: true,
			observed: ArmedState.ARMED_AWAY,
		});
		expect(await card().evaluate({ states: [ArmedState.DISARMED] }, runContext())).toEqual({
			result: false,
			observed: ArmedState.ARMED_AWAY,
		});
	});

	it('answers no when no alarm reports an armed state, or the status can not be read', async () => {
		armedState.mockResolvedValueOnce(null);

		expect(await card().evaluate({ states: [ArmedState.DISARMED] }, runContext())).toEqual({
			result: false,
			reason: 'No alarm reports an armed state.',
		});

		armedState.mockRejectedValueOnce(new Error('Database is locked'));

		expect(await card().evaluate({ states: [ArmedState.DISARMED] }, runContext())).toEqual({
			result: false,
			reason: 'The armed state could not be read: Database is locked',
		});
	});
});
