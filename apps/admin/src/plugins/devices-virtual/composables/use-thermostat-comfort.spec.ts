import { effectScope, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import type { ComfortSnapshot, ComfortTransport } from '../services/thermostat-comfort';

import { useThermostatComfort } from './use-thermostat-comfort';

const snapshot = (id = 'a', revision = 1): ComfortSnapshot =>
	({
		comfort: {
			controller: id,
			revision,
			graph_revision: 5,
			configuration: null,
			effective: { source: 'manual', preset: null, heating_setpoint: 0, cooling_setpoint: null, override_id: null, expires_at: null },
			clock_policy: 'future-policy',
		},
		configuration: { revision, locked: false, requested_mode: 'off', policy: { heatingSetpoint: 0, coolingSetpoint: null } },
		runtime: { configuration_revision: revision, reasons: [], branches: [] },
	}) as unknown as ComfortSnapshot;
const deferred = <T>() => {
	let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const setup = (transport: ComfortTransport) => {
	const id = ref('a');
	const scope = effectScope();
	const state = scope.run(() => useThermostatComfort(id, transport))!;
	return {
		state,
		id,
		stop: () => {
			state.dispose();
			scope.stop();
		},
	};
};

describe('comfort request fencing', () => {
	it('preserves nullable and false legacy fields without inventing temperatures or presets', async () => {
		const { state, stop } = setup({ read: vi.fn().mockResolvedValue(snapshot()), write: vi.fn() });
		await state.reload();
		expect(state.snapshot.value?.comfort.configuration).toBeNull();
		expect(state.snapshot.value?.configuration.locked).toBe(false);
		expect(state.snapshot.value?.comfort.effective.heating_setpoint).toBe(0);
		expect(state.snapshot.value?.comfort.effective.cooling_setpoint).toBeNull();
		stop();
	});
	it('rejects old controller and edited reads, including late responses after disposal', async () => {
		const old = deferred<ComfortSnapshot>(),
			next = deferred<ComfortSnapshot>();
		const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise).mockResolvedValue(snapshot('b', 3));
		const { state, id, stop } = setup({ read, write: vi.fn() });
		const pending = state.reload();
		id.value = 'b';
		old.resolve(snapshot('a', 99));
		await pending;
		expect(state.snapshot.value).toBeNull();
		next.resolve(snapshot('b', 2));
		await Promise.resolve();
		await Promise.resolve();
		expect(state.snapshot.value?.comfort.controller).toBe('b');
		const late = deferred<ComfortSnapshot>();
		read.mockReturnValueOnce(late.promise);
		const loading = state.reload();
		state.invalidate();
		late.resolve(snapshot('b', 99));
		await loading;
		expect(state.ready.value).toBe(false);
		stop();
		await state.reload();
		expect(state.ready.value).toBe(false);
	});
	it('captures exact cancellation identity and revisions; conflicting writes reload current baseline', async () => {
		const write = vi.fn().mockRejectedValue(new Error('revision_conflict'));
		const read = vi.fn().mockResolvedValueOnce(snapshot()).mockResolvedValue(snapshot('a', 8));
		const { state, stop } = setup({ read, write });
		await state.reload();
		expect(await state.act({ kind: 'cancel', override_id: 'exact-id' })).toBe(false);
		expect(write).toHaveBeenCalledWith('a', expect.objectContaining({ revision: 1, graph_revision: 5 }), { kind: 'cancel', override_id: 'exact-id' });
		expect(state.snapshot.value?.comfort.revision).toBe(8);
		expect(state.error.value).toContain('revision_conflict');
		stop();
	});
	it('never applies a mutation response as state, and a command/reconnect fences its pending read', async () => {
		const command = deferred<void>();
		const write = vi.fn().mockReturnValue(command.promise),
			read = vi.fn().mockResolvedValue(snapshot());
		const { state, stop } = setup({ read, write });
		await state.reload();
		const action = state.act({ kind: 'selection', preset: null, clear_user_off: false });
		state.invalidate();
		command.resolve();
		expect(await action).toBe(false);
		expect(read).toHaveBeenCalledTimes(2);
		state.serverRevision(20);
		expect(state.ready.value).toBe(false);
		await Promise.resolve();
		await Promise.resolve();
		expect(state.ready.value).toBe(false);
		stop();
	});
	it('refuses actions while a newer server revision or edit is unresolved', async () => {
		const next = deferred<ComfortSnapshot>(),
			write = vi.fn();
		const read = vi.fn().mockResolvedValueOnce(snapshot()).mockReturnValue(next.promise);
		const { state, stop } = setup({ read, write });
		await state.reload();
		state.edit();
		await state.act({ kind: 'selection', preset: 'eco', clear_user_off: true });
		expect(write).not.toHaveBeenCalled();
		next.resolve(snapshot('a', 4));
		await Promise.resolve();
		await Promise.resolve();
		stop();
	});
});
