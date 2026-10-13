import { effectScope, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useThermostatPreviewGate } from './use-thermostat-preview-gate';

interface Draft {
	source: string;
	policy: { heatingSetpoint: number };
}

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

const harness = () => {
	const scope = effectScope();
	scopes.push(scope);
	return scope.run(() => {
		const draft = ref<Draft>({ source: 'room-a', policy: { heatingSetpoint: 21 } });
		const name = ref('Hall');
		const preview = ref<string | null>(null);
		const error = ref<string | null>(null);
		const busy = ref(false);
		const create = vi.fn();
		const gate = useThermostatPreviewGate(
			() => JSON.stringify({ draft: draft.value, name: name.value }),
			[draft, name],
			() => {
				preview.value = null;
				busy.value = false;
			}
		);
		const save = () => {
			if (preview.value && gate.canSave.value) create();
		};
		const run = (response: Promise<string>) => {
			const ticket = gate.begin({ draft: draft.value, name: name.value });
			busy.value = true;
			error.value = null;
			const completed = response
				.then((result) => {
					if (gate.isCurrent(ticket) && gate.approve(ticket)) preview.value = result;
				})
				.catch((reason: Error) => {
					if (gate.isCurrent(ticket)) error.value = reason.message;
				})
				.finally(() => {
					if (gate.isCurrent(ticket)) busy.value = false;
				});
			return { completed, request: ticket.request };
		};
		return { draft, name, preview, error, busy, gate, save, create, run };
	})!;
};

describe('thermostat preview approval', () => {
	it.each(['source', 'policy', 'name'] as const)('rejects a late preview after a %s edit', async (field) => {
		const editor = harness();
		const response = deferred<string>();
		const { completed, request } = editor.run(response.promise);
		if (field === 'source') editor.draft.value.source = 'room-b';
		if (field === 'policy') editor.draft.value.policy.heatingSetpoint = 22;
		if (field === 'name') editor.name.value = 'Kitchen';
		expect(editor.busy.value).toBe(false);
		response.resolve('approved old draft');
		await completed;
		expect(request).toEqual({ draft: { source: 'room-a', policy: { heatingSetpoint: 21 } }, name: 'Hall' });
		expect(editor.preview.value).toBeNull();
		expect(editor.gate.canSave.value).toBe(false);
		editor.save();
		expect(editor.create).not.toHaveBeenCalled();
	});

	it('ignores obsolete success, error, and completion while the latest preview is pending', async () => {
		const editor = harness();
		const first = deferred<string>();
		const second = deferred<string>();
		const third = deferred<string>();
		const firstRun = editor.run(first.promise);
		editor.draft.value.source = 'room-b';
		const secondRun = editor.run(second.promise);
		first.resolve('old source');
		await firstRun.completed;
		expect(editor.preview.value).toBeNull();
		expect(editor.busy.value).toBe(true);
		const thirdRun = editor.run(third.promise);
		second.reject(new Error('obsolete conflict'));
		await secondRun.completed;
		expect(editor.error.value).toBeNull();
		expect(editor.busy.value).toBe(true);
		third.resolve('current source');
		await thirdRun.completed;
		expect(editor.preview.value).toBe('current source');
		expect(editor.gate.canSave.value).toBe(true);
		expect(editor.busy.value).toBe(false);
		editor.save();
		expect(editor.create).toHaveBeenCalledOnce();
		editor.name.value = 'Kitchen';
		editor.save();
		expect(editor.create).toHaveBeenCalledOnce();
	});
});
