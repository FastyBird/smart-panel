import { ref } from 'vue';

import { ElAlert } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import SystemHealthBanner from './system-health-banner.vue';

enableAutoUnmount(afterEach);

const updateAvailable = ref(false);
const latestVersion = ref<string | null>(null);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../composables/composables', () => ({
	useUpdateStatus: () => ({ updateAvailable, latestVersion }),
}));

const OK = { undervoltage: false, frequencyCapping: false, throttling: false, softTempLimit: false };

describe('SystemHealthBanner', () => {
	afterEach(() => {
		updateAvailable.value = false;
		latestVersion.value = null;
	});

	it('is all well with no problem and nothing to install', () => {
		const alert = mount(SystemHealthBanner, { props: { throttleStatus: OK } }).findComponent(ElAlert);

		expect(alert.props('type')).toBe('success');
		expect(alert.props('title')).toBe('systemModule.health.okTitle');
	});

	it('tells about an update waiting', () => {
		updateAvailable.value = true;
		latestVersion.value = '1.4.0';

		const alert = mount(SystemHealthBanner, { props: { throttleStatus: OK } }).findComponent(ElAlert);

		expect(alert.props('type')).toBe('info');
		expect(alert.props('title')).toBe('systemModule.texts.update.available');
	});

	it('puts a power or temperature problem first, naming each flag', () => {
		updateAvailable.value = true;
		latestVersion.value = '1.4.0';

		const alert = mount(SystemHealthBanner, {
			props: { throttleStatus: { ...OK, undervoltage: true, softTempLimit: true } },
		}).findComponent(ElAlert);

		expect(alert.props('type')).toBe('error');
		expect(alert.props('title')).toBe('systemModule.health.problemTitle');
		expect(alert.props('description')).toBe('systemModule.systemInfo.undervoltage · systemModule.systemInfo.softTempLimit');
	});
});
