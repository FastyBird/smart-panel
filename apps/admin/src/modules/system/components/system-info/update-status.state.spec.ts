import { computed, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { StatusTag } from '../../../../common';

import UpdateStatus from './update-status.vue';

enableAutoUnmount(afterEach);

const currentVersion = ref<string | null>(null);
const latestVersion = ref<string | null>(null);
const updateAvailable = ref(false);
const loading = ref(false);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

vi.mock('../../composables/composables', () => ({
	useUpdateStatus: () => ({
		currentVersion,
		latestVersion,
		updateAvailable,
		updateType: ref(null),
		lastChecked: ref(null),
		status: ref('idle'),
		phase: ref(null),
		progressPercent: ref(null),
		error: ref(null),
		loading,
		waitingForRestart: ref(false),
		isUpdating: computed(() => false),
		fetchStatus: vi.fn(),
		checkForUpdates: vi.fn(),
		installUpdate: vi.fn(),
	}),
}));

const tag = () => mount(UpdateStatus, { global: { stubs: { Icon: true } } }).findComponent(StatusTag);

describe('UpdateStatus state', () => {
	beforeEach(() => {
		currentVersion.value = null;
		latestVersion.value = null;
		updateAvailable.value = false;
		loading.value = false;
	});

	it('says it is checking until the backend has answered', () => {
		loading.value = true;

		expect(tag().props()).toMatchObject({ status: 'info', label: 'systemModule.texts.update.checking' });
	});

	it('does not call the system up to date when the status could not be read', () => {
		expect(tag().props()).toMatchObject({ status: 'info', label: 'systemModule.texts.update.noVersionInfo' });
	});

	it('is up to date only after an answer without an update', () => {
		currentVersion.value = '1.1.0';
		latestVersion.value = '1.1.0';

		expect(tag().props()).toMatchObject({ status: 'ok', label: 'systemModule.texts.update.upToDate' });
	});

	it('names the version waiting', () => {
		currentVersion.value = '1.1.0';
		latestVersion.value = '1.2.0';
		updateAvailable.value = true;

		expect(tag().props()).toMatchObject({ status: 'warn', label: 'systemModule.texts.update.available' });
	});
});
