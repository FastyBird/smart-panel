import { nextTick } from 'vue';

import mitt from 'mitt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import AppMain from './app.main.vue';
import { eventBusKey } from './common';

vi.mock('vue-meta', () => ({
	useMeta: () => undefined,
}));

// `app.main.vue` imports `vLoading` directly (`import { vLoading } from 'element-plus'`), so
// `<script setup>` binds `v-loading` to that local import at compile time and never goes through
// runtime directive resolution — a `global.directives` stub on `mount()` would never be consulted.
// Mocking the module export is the only way to observe what value the directive receives. Keep the
// rest of the real module intact: `./common` transitively pulls in other `element-plus` exports.
vi.mock('element-plus', async (importOriginal) => {
	const actual = await importOriginal<typeof import('element-plus')>();

	return {
		...actual,
		vLoading: (el: HTMLElement, binding: { value: unknown }): void => {
			el.setAttribute('data-loading', String(binding.value));
		},
	};
});

describe('AppMain', (): void => {
	let eventBus: ReturnType<typeof mitt>;
	let wrapper: VueWrapper;

	const overlayState = (): string | null => wrapper.find('[data-loading]').attributes('data-loading') ?? null;

	beforeEach((): void => {
		vi.useFakeTimers();

		eventBus = mitt();

		wrapper = mount(AppMain, {
			global: {
				provide: {
					[eventBusKey as symbol]: eventBus,
				},
				stubs: {
					metainfo: true,
					'router-view': true,
				},
			},
		});
	});

	afterEach((): void => {
		wrapper.unmount();

		vi.useRealTimers();
	});

	it('turns the overlay on for a numeric duration and off once it elapses', async (): Promise<void> => {
		eventBus.emit('loadingOverlay', 5);
		await nextTick();

		expect(overlayState()).toBe('true');

		await vi.advanceTimersByTimeAsync(5_000);

		expect(overlayState()).toBe('false');
	});

	it('a second timed overlay request does not strand a timer that later forces the overlay off', async (): Promise<void> => {
		eventBus.emit('loadingOverlay', 10);
		await vi.advanceTimersByTimeAsync(1_000);
		eventBus.emit('loadingOverlay', 10); // re-arm before the first fires

		await vi.advanceTimersByTimeAsync(10_000); // both original deadlines pass
		eventBus.emit('loadingOverlay', true); // explicit ON

		await vi.advanceTimersByTimeAsync(30_000);

		// with the stranded-interval bug, the leftover interval keeps forcing this off
		expect(overlayState()).toBe('true');
	});
});
