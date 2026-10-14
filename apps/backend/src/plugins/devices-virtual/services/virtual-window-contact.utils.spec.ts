import { createVirtualWindowContactState, evaluateVirtualWindowContact } from './virtual-window-contact.utils';

const policy = { openingMs: 1000, closingMs: 2000 };
const step = (
	state: ReturnType<typeof createVirtualWindowContactState>,
	now: number,
	reported: 'open' | 'closed' | null,
	basis = 'contact:1',
) => evaluateVirtualWindowContact(state, policy, { now, reported, basis });

describe('qualified physical window debounce', () => {
	it('starts unknown and requires fresh closed evidence across the closing delay', () => {
		const initial = step(createVirtualWindowContactState(), 0, 'closed');
		expect(initial.confirmed).toBe('unknown');
		expect(step(initial, 1999, 'closed').confirmed).toBe('unknown');
		expect(step(initial, 2000, 'closed').confirmed).toBe('closed');
	});
	it('uses an independent opening delay and cancels contact bounce', () => {
		const closed = step(step(createVirtualWindowContactState(), 0, 'closed'), 2000, 'closed');
		const opening = step(closed, 3000, 'open');
		expect(step(opening, 3999, 'open').confirmed).toBe('closed');
		expect(step(opening, 4000, 'open').confirmed).toBe('open');
		const bounced = step(opening, 3500, 'closed');
		expect(bounced.candidate).toBeNull();
		expect(step(bounced, 4000, 'open').confirmed).toBe('closed');
	});
	it('missing/stale/error evidence invalidates closed immediately and recovery starts a new delay', () => {
		const closed = step(step(createVirtualWindowContactState(), 0, 'closed'), 2000, 'closed');
		const fault = step(closed, 2500, null);
		expect(fault.confirmed).toBe('unknown');
		const recovering = step(fault, 3000, 'closed');
		expect(step(recovering, 4999, 'closed').confirmed).toBe('unknown');
		expect(step(recovering, 5000, 'closed').confirmed).toBe('closed');
	});
	it('input/remap identity changes cannot reuse a prior closed confirmation', () => {
		const closed = step(step(createVirtualWindowContactState(), 0, 'closed'), 2000, 'closed');
		expect(step(closed, 3000, 'closed', 'replacement').confirmed).toBe('unknown');
	});
	it('clock rollback invalidates the confirmed contact and zero configured delays remain explicit', () => {
		const closed = step(step(createVirtualWindowContactState(), 0, 'closed'), 2000, 'closed');
		expect(step(closed, 1999, 'closed').confirmed).toBe('unknown');
		expect(
			evaluateVirtualWindowContact(
				createVirtualWindowContactState(),
				{ openingMs: 0, closingMs: 0 },
				{ now: 0, basis: 'contact:1', reported: 'open' },
			).confirmed,
		).toBe('open');
	});
});
