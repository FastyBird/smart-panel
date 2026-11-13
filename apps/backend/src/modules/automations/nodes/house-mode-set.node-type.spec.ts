import { HouseMode } from '../../system/system.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { abortedSignal, runContext } from '../testing/node-fixtures';

import { HOUSE_MODE_SET_NODE_TYPE, createHouseModeSetNodeType } from './house-mode-set.node-type';

describe('house-mode.set', () => {
	let mode: string | null;
	let setHouseMode: jest.Mock<Promise<void>, [HouseMode]>;

	const card = () => createHouseModeSetNodeType({ houseMode: () => mode, setHouseMode });

	beforeEach(() => {
		mode = HouseMode.HOME;
		setHouseMode = jest.fn<Promise<void>, [HouseMode]>(() => Promise.resolve());
	});

	it('is an action with a done and an error output that does not act on a device', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: HOUSE_MODE_SET_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
		});
		expect(registered.commands({ mode: HouseMode.AWAY })).toEqual([]);
	});

	it('needs one house mode', async () => {
		expect(await card().validateConfig({ mode: HouseMode.NIGHT })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([
			{ field: 'mode', reason: 'The house mode must be one of home, away, night.' },
		]);
		expect(await card().validateConfig({ mode: 'vacation' })).toEqual([
			{ field: 'mode', reason: 'The house mode must be one of home, away, night.' },
		]);
	});

	it('sets the house mode', async () => {
		expect(await card().execute({ mode: HouseMode.AWAY }, runContext())).toEqual({ success: true });
		expect(setHouseMode).toHaveBeenCalledWith(HouseMode.AWAY);
	});

	it('leaves a house mode that is already the one asked for alone', async () => {
		expect(await card().execute({ mode: HouseMode.HOME }, runContext())).toEqual({ success: true });
		expect(setHouseMode).not.toHaveBeenCalled();
	});

	it('takes the error output when the house mode can not be set', async () => {
		setHouseMode.mockRejectedValue(new Error('New configuration for module is invalid.'));

		expect(await card().execute({ mode: HouseMode.NIGHT }, runContext())).toEqual({
			success: false,
			reason: 'The house mode was not set: New configuration for module is invalid.',
		});
	});

	it('does not set the house mode for a run that was cancelled before it got here', async () => {
		expect(await card().execute({ mode: HouseMode.AWAY }, runContext({ signal: abortedSignal() }))).toMatchObject({
			success: false,
		});
		expect(setHouseMode).not.toHaveBeenCalled();
	});
});
