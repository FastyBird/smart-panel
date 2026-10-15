import { effectScope, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useThermostatMemberContext } from './use-thermostat-member-context';

const deferred = <T>() => {
	let resolve!: (result: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
describe('member source and profile generations', () => {
	it('rejects an old source response, clears context after refusal/disconnect and fences unmount', async () => {
		const first = deferred<string>(),
			second = deferred<string>(),
			third = deferred<string>();
		const read = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise)
			.mockRejectedValueOnce(new Error('revision_conflict'))
			.mockReturnValueOnce(third.promise);
		const scope = effectScope();
		const key = ref('a');
		const state = scope.run(() => useThermostatMemberContext(key, read))!;
		key.value = 'b';
		first.resolve('old-a');
		await nextTick();
		await Promise.resolve();
		expect(state.value.value).toBeNull();
		second.resolve('current-b');
		await Promise.resolve();
		await nextTick();
		expect(state.value.value).toBe('current-b');
		await state.reload();
		expect(state.value.value).toBeNull();
		expect(state.error.value).toContain('revision_conflict');
		const pending = state.reload();
		state.invalidate();
		third.resolve('late-b');
		await pending;
		expect(state.value.value).toBeNull();
		const pendingUnmount = state.reload();
		scope.stop();
		await pendingUnmount;
		expect(state.value.value).toBeNull();
	});
});
