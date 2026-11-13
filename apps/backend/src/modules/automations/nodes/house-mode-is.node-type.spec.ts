import { HouseMode } from '../../system/system.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { runContext } from '../testing/node-fixtures';

import { HOUSE_MODE_IS_NODE_TYPE, createHouseModeIsNodeType } from './house-mode-is.node-type';

describe('house-mode.is', () => {
	let mode: string | null;

	const card = () => createHouseModeIsNodeType({ houseMode: () => mode });

	beforeEach(() => {
		mode = HouseMode.HOME;
	});

	it('is a condition with a yes and a no output', () => {
		expect(normalizeAutomationNodeType(card())).toMatchObject({
			type: HOUSE_MODE_IS_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		});
	});

	it('takes one or more house modes, each once', async () => {
		expect(await card().validateConfig({ modes: [HouseMode.AWAY, HouseMode.NIGHT] })).toEqual([]);

		for (const config of [{}, { modes: [] }, { modes: ['vacation'] }, { modes: [HouseMode.AWAY, HouseMode.AWAY] }]) {
			expect((await card().validateConfig(config)).map((problem) => problem.field)).toEqual(['modes']);
		}
	});

	it('answers yes when the house mode is one of the chosen modes', async () => {
		expect(await card().evaluate({ modes: [HouseMode.HOME, HouseMode.NIGHT] }, runContext())).toEqual({
			result: true,
			observed: HouseMode.HOME,
		});

		mode = HouseMode.AWAY;

		expect(await card().evaluate({ modes: [HouseMode.HOME, HouseMode.NIGHT] }, runContext())).toEqual({
			result: false,
			observed: HouseMode.AWAY,
		});
	});

	it('answers no when the house mode can not be read', async () => {
		mode = null;

		expect(await card().evaluate({ modes: [HouseMode.HOME] }, runContext())).toEqual({
			result: false,
			reason: 'The house mode could not be read.',
		});
	});
});
