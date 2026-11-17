import { effectScope, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useVirtualWizardError } from './use-virtual-wizard-error';

const flash = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('../../../common', () => ({ useFlashMessage: () => flash }));

describe('virtual wizard request feedback', () => {
	it('reports each failure once, permits retry feedback and stops notifying after leaving', async () => {
		flash.error.mockClear();
		const error = ref<string | null>(null);
		const scope = effectScope();
		scope.run(() => useVirtualWizardError(error));
		error.value = 'Request failed';
		await nextTick();
		expect(flash.error).toHaveBeenCalledExactlyOnceWith('Request failed');
		error.value = 'Request failed';
		await nextTick();
		expect(flash.error).toHaveBeenCalledTimes(1);
		error.value = null;
		await nextTick();
		error.value = 'Request failed';
		await nextTick();
		expect(flash.error).toHaveBeenCalledTimes(2);
		scope.stop();
		error.value = 'Late failure';
		await nextTick();
		expect(flash.error).toHaveBeenCalledTimes(2);
	});
});
