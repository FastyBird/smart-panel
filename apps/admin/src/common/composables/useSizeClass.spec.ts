import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const widths = { tp: ref(false), tl: ref(false), dt: ref(false), wd: ref(false) };
const coarse = ref(false);
const reads = { count: 0 };

// Like VueUse's, every read of a breakpoint goes through a getter (which there starts a media-query listener)
vi.mock('@vueuse/core', () => ({
	useBreakpoints: vi.fn(() => ({
		get tp() {
			reads.count++;
			return widths.tp;
		},
		get tl() {
			reads.count++;
			return widths.tl;
		},
		get dt() {
			reads.count++;
			return widths.dt;
		},
		get wd() {
			reads.count++;
			return widths.wd;
		},
	})),
	useMediaQuery: vi.fn(() => coarse),
}));

const setWidth = (px: number): void => {
	widths.tp.value = px >= 720;
	widths.tl.value = px >= 1024;
	widths.dt.value = px >= 1280;
	widths.wd.value = px >= 1600;
};

describe('useSizeClass', () => {
	beforeEach(() => {
		setWidth(0);
		coarse.value = false;
	});

	it.each([
		[390, 'phone'],
		[719, 'phone'],
		[720, 'tp'],
		[744, 'tp'],
		[1023, 'tp'],
		[1024, 'tl'],
		[1279, 'tl'],
		[1280, 'dt'],
		[1440, 'dt'],
		[1600, 'wd'],
		[1920, 'wd'],
	])('classifies %i px as %s', async (px, expected) => {
		const { useSizeClass } = await import('./useSizeClass');

		setWidth(px);

		expect(useSizeClass().sizeClass.value).toBe(expected);
	});

	it('exposes one flag per size class, desktop covering wide', async () => {
		const { useSizeClass } = await import('./useSizeClass');
		const size = useSizeClass();

		setWidth(1920);

		expect(size.isDesktop.value).toBe(true);
		expect(size.isPhone.value).toBe(false);

		setWidth(1100);

		expect(size.isTabletLandscape.value).toBe(true);
		expect(size.isDesktop.value).toBe(false);

		setWidth(800);

		expect(size.isTabletPortrait.value).toBe(true);
	});

	it('reads each breakpoint getter once, however often the size class changes', async () => {
		const { useSizeClass } = await import('./useSizeClass');
		const before = reads.count;
		const size = useSizeClass();

		for (const px of [390, 800, 1100, 1300, 1700, 390]) {
			setWidth(px);
			void size.sizeClass.value;
		}

		expect(reads.count).toBe(before);
		expect(before).toBe(4);
	});

	it('reports touch from a coarse pointer', async () => {
		const { useSizeClass } = await import('./useSizeClass');
		const size = useSizeClass();

		expect(size.isTouch.value).toBe(false);

		coarse.value = true;

		expect(size.isTouch.value).toBe(true);
	});

	it('uses the size-class widths of the spec', async () => {
		const { SIZE_CLASS_BREAKPOINTS } = await import('../common.constants');

		expect(SIZE_CLASS_BREAKPOINTS).toEqual({ tp: 720, tl: 1024, dt: 1280, wd: 1600 });
	});
});
