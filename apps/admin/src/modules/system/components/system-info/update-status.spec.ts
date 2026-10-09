import { computed, ref } from 'vue';

import { ElDialog } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import UpdateStatus from './update-status.vue';

const status = ref('idle');
const waitingForRestart = ref(false);
const error = ref<string | null>(null);
const reload = vi.fn();
const installUpdate = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../composables/composables', () => ({
	useUpdateStatus: () => ({
		currentVersion: ref('1.1.0-alpha.53'),
		latestVersion: ref('1.1.0-alpha.54'),
		updateAvailable: ref(true),
		updateType: ref('patch'),
		lastChecked: ref(null),
		status,
		phase: ref(null),
		progressPercent: ref(100),
		error,
		loading: ref(false),
		waitingForRestart,
		isUpdating: computed(() => ['downloading', 'stopping', 'installing', 'migrating', 'starting'].includes(status.value)),
		fetchStatus: vi.fn(),
		checkForUpdates: vi.fn(),
		installUpdate,
	}),
}));

describe('UpdateStatus', () => {
	let wrapper: VueWrapper;

	beforeEach(async () => {
		vi.clearAllMocks();
		status.value = 'idle';
		waitingForRestart.value = false;
		error.value = null;

		// jsdom's Location methods are not configurable; replace only window.location
		// through a proxy so the real Element Plus dialog keeps its browser APIs.
		vi.stubGlobal(
			'window',
			new Proxy(window, {
				get(target, key) {
					return key === 'location' ? { reload } : Reflect.get(target, key);
				},
			})
		);

		wrapper = mount(UpdateStatus, {
			attachTo: document.body,
			global: { stubs: { ElTeleport: { template: '<div><slot /></div>' }, transition: false, Icon: true } },
		});
		await wrapper.get('button').trigger('click');
		await flushPromises();
	});

	afterEach(async () => {
		wrapper.unmount();
		await flushPromises();
		vi.unstubAllGlobals();
	});

	const dismiss = async (method: string): Promise<void> => {
		if (method === 'footer') {
			await wrapper.get('.el-dialog__footer button').trigger('click');
		} else if (method === 'header') {
			await wrapper.get('.el-dialog__headerbtn').trigger('click');
		} else if (method === 'backdrop') {
			const backdrop = wrapper.get('.el-overlay-dialog');
			await backdrop.trigger('mousedown');
			await backdrop.trigger('mouseup');
			await backdrop.trigger('click');
		} else {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
		}

		await vi.waitFor(() => expect(wrapper.getComponent(ElDialog).props('modelValue')).toBe(false));
		await flushPromises();
	};

	it.each(['footer', 'header', 'backdrop', 'escape'])(
		'reloads the new admin assets once after dismissing a completed update with %s',
		async (method) => {
			status.value = 'complete';
			await flushPromises();

			expect(wrapper.text()).toContain('systemModule.messages.update.updateComplete');
			expect(reload).not.toHaveBeenCalled();

			await dismiss(method);

			expect(reload).toHaveBeenCalledTimes(1);
			expect(installUpdate).not.toHaveBeenCalled();
		}
	);

	it.each(['idle', 'failed'].flatMap((updateStatus) => ['footer', 'header', 'backdrop', 'escape'].map((method) => [updateStatus, method])))(
		'does not reload when dismissing %s update status with %s',
		async (updateStatus, method) => {
			status.value = updateStatus;
			error.value = updateStatus === 'failed' ? 'systemModule.messages.update.updateFailed' : null;
			await flushPromises();

			await dismiss(method);

			expect(reload).not.toHaveBeenCalled();
			expect(installUpdate).not.toHaveBeenCalled();
		}
	);

	it('does not reload when an update completes after the dialog was already dismissed', async () => {
		await dismiss('footer');
		status.value = 'complete';
		await flushPromises();

		expect(reload).not.toHaveBeenCalled();
	});

	it.each(['installing', 'restart'])('keeps the dialog open without reloading while waiting for %s', async (state) => {
		status.value = 'installing';
		waitingForRestart.value = state === 'restart';
		await flushPromises();

		const dialog = wrapper.getComponent(ElDialog);
		expect(dialog.props('showClose')).toBe(false);
		expect(wrapper.find('.el-dialog__footer button').exists()).toBe(false);

		const backdrop = wrapper.get('.el-overlay-dialog');
		await backdrop.trigger('mousedown');
		await backdrop.trigger('mouseup');
		await backdrop.trigger('click');
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
		await flushPromises();

		expect(dialog.props('modelValue')).toBe(true);
		expect(reload).not.toHaveBeenCalled();
	});
});
