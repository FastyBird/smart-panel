import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import WindowDetectionReporting from './window-detection-reporting.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: unknown) => `${key}${params ? JSON.stringify(params) : ''}`, locale: { value: 'en' } }),
}));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
}));

const cadence = { sampleWindowMs: 180_000, minimumSamples: 3, maximumSampleAgeMs: 120_000 };
const profile = (typical: number | null) => ({
	data: { data: { property: 'room', source_kind: 'physical', reports: typical === null ? 1 : 20, typical_interval_seconds: typical } },
});

describe('WindowDetectionReporting', () => {
	beforeEach(() => mocks.GET.mockReset());

	it('warns that a slow radio room sensor rarely lets detection work', async () => {
		mocks.GET.mockResolvedValue(profile(3_300));
		const wrapper = mount(WindowDetectionReporting, { props: { property: 'room', cadence } });
		await flushPromises();
		expect(wrapper.get('[data-test-id="window-detection-too-slow"]').text()).toContain('windowDetection.tooSlow.message');
		expect(wrapper.text()).toContain('"required":"1m 30s"');
	});

	it('shows the requirement and the observed cadence for a sensor that reports often enough', async () => {
		mocks.GET.mockResolvedValue(profile(10));
		const wrapper = mount(WindowDetectionReporting, { props: { property: 'room', cadence } });
		await flushPromises();
		const text = wrapper.get('[data-test-id="window-detection-requirement"]').text();
		expect(text).toContain('windowDetection.requirement');
		expect(text).toContain('windowDetection.fits');
	});

	it('shows only the requirement without a room source', async () => {
		const wrapper = mount(WindowDetectionReporting, { props: { property: null, cadence } });
		await flushPromises();
		expect(mocks.GET).not.toHaveBeenCalled();
		expect(wrapper.get('[data-test-id="window-detection-requirement"]').text()).not.toContain('windowDetection.fits');
	});
});
