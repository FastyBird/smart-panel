import { effectScope } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardOffset } from './useKeyboardOffset';

class FakeVisualViewport extends EventTarget {
	height = 800;
	offsetTop = 0;
}

describe('useKeyboardOffset', () => {
	let viewport: FakeVisualViewport;

	beforeEach(() => {
		viewport = new FakeVisualViewport();

		vi.stubGlobal('visualViewport', viewport);
		vi.stubGlobal('innerHeight', 800);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is 0 without a keyboard', () => {
		const scope = effectScope();
		const { offset } = scope.run(() => useKeyboardOffset())!;

		expect(offset.value).toBe(0);

		scope.stop();
	});

	it('follows the keyboard as the visual viewport shrinks and scrolls', () => {
		const scope = effectScope();
		const { offset } = scope.run(() => useKeyboardOffset())!;

		viewport.height = 500;
		viewport.dispatchEvent(new Event('resize'));

		expect(offset.value).toBe(300);

		viewport.offsetTop = 100;
		viewport.dispatchEvent(new Event('scroll'));

		expect(offset.value).toBe(200);

		viewport.height = 800;
		viewport.offsetTop = 0;
		viewport.dispatchEvent(new Event('resize'));

		expect(offset.value).toBe(0);

		scope.stop();
	});

	it('stops listening when its scope ends', () => {
		const scope = effectScope();
		const { offset } = scope.run(() => useKeyboardOffset())!;

		scope.stop();

		viewport.height = 500;
		viewport.dispatchEvent(new Event('resize'));

		expect(offset.value).toBe(0);
	});

	it('is 0 when the browser has no visualViewport', () => {
		vi.stubGlobal('visualViewport', undefined);

		const { offset } = useKeyboardOffset();

		expect(offset.value).toBe(0);
	});
});
