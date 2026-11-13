import { SecurityStateChangedPayload } from '../../security/contracts/security-state-changed.type';
import { AlarmState, ArmedState } from '../../security/security.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';

import {
	SECURITY_STATE_CHANGED_NODE_TYPE,
	createSecurityStateChangedNodeType,
} from './security-state-changed.node-type';

describe('security.state.changed', () => {
	let listeners: Set<(transition: SecurityStateChangedPayload) => void>;

	const card = () =>
		createSecurityStateChangedNodeType({
			onSecurityStateChanged: (listener) => {
				listeners.add(listener);

				return () => listeners.delete(listener);
			},
		});

	const transition = (payload: SecurityStateChangedPayload): void => {
		for (const listener of [...listeners]) listener(payload);
	};

	beforeEach(() => {
		listeners = new Set();
	});

	it('is a trigger with nothing it refers to', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({ type: SECURITY_STATE_CHANGED_NODE_TYPE, kind: 'trigger' });
		expect(registered.references({ kind: 'armed' })).toEqual([]);
		expect(card().configSchema).toMatchObject({
			required: ['kind'],
			'x-states-by-kind': { armed: Object.values(ArmedState), alarm: Object.values(AlarmState) },
		});
	});

	it('takes the state to watch and optionally the states it changes to and from', async () => {
		expect(await card().validateConfig({ kind: 'armed' })).toEqual([]);
		expect(
			await card().validateConfig({ kind: 'armed', to: ArmedState.ARMED_AWAY, from: ArmedState.DISARMED }),
		).toEqual([]);
		expect(await card().validateConfig({ kind: 'alarm', to: AlarmState.TRIGGERED })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([{ field: 'kind', reason: 'The state must be armed or alarm.' }]);
	});

	it('refuses a state of the other kind and a change to the state it changes from', async () => {
		expect(await card().validateConfig({ kind: 'armed', to: AlarmState.TRIGGERED })).toEqual([
			{ field: 'to', reason: '"to" must be one of disarmed, armed_home, armed_away, armed_night.' },
		]);
		expect(await card().validateConfig({ kind: 'alarm', from: ArmedState.DISARMED })).toEqual([
			{ field: 'from', reason: '"from" must be one of idle, pending, triggered, silenced.' },
		]);
		expect(await card().validateConfig({ kind: 'alarm', to: AlarmState.IDLE, from: AlarmState.IDLE })).toEqual([
			{ field: 'to', reason: 'The state can not change to the state it changes from.' },
		]);
	});

	it('starts on every transition of the state it watches', () => {
		const fire = jest.fn();

		card().subscribe({ kind: 'armed' }, fire);

		transition({ kind: 'armed', from: ArmedState.DISARMED, to: ArmedState.ARMED_AWAY });
		transition({ kind: 'alarm', from: AlarmState.IDLE, to: AlarmState.TRIGGERED });
		transition({ kind: 'armed', from: ArmedState.ARMED_AWAY, to: null });

		expect(fire.mock.calls).toEqual([
			[{ kind: 'armed', from: ArmedState.DISARMED, to: ArmedState.ARMED_AWAY }],
			[{ kind: 'armed', from: ArmedState.ARMED_AWAY, to: null }],
		]);
	});

	it('starts only on a change into and out of the states asked for', () => {
		const fire = jest.fn();

		card().subscribe({ kind: 'alarm', to: AlarmState.TRIGGERED, from: AlarmState.PENDING }, fire);

		transition({ kind: 'alarm', from: AlarmState.IDLE, to: AlarmState.TRIGGERED });
		transition({ kind: 'alarm', from: AlarmState.IDLE, to: AlarmState.PENDING });
		transition({ kind: 'alarm', from: AlarmState.PENDING, to: AlarmState.TRIGGERED });

		expect(fire.mock.calls).toEqual([[{ kind: 'alarm', from: AlarmState.PENDING, to: AlarmState.TRIGGERED }]]);
	});

	it('stops listening when it is released', () => {
		const fire = jest.fn();

		card().subscribe({ kind: 'armed' }, fire)();
		transition({ kind: 'armed', from: ArmedState.DISARMED, to: ArmedState.ARMED_HOME });

		expect(fire).not.toHaveBeenCalled();
	});
});
