import type { Ref } from 'vue';

import { ElAlert, ElMessageBox } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import type { IBackup } from '../composables/useBackups';

import SystemBackupActions from './system-backup-actions.vue';
import SystemBackups from './system-backups.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	isPhone: null as unknown as Ref<boolean>,
	backups: null as unknown as Ref<IBackup[]>,
	loading: null as unknown as Ref<boolean>,
	failed: null as unknown as Ref<boolean>,
	fetchBackups: vi.fn(),
	deleteBackup: vi.fn(),
	restoreBackup: vi.fn(),
	downloadBackup: vi.fn(),
	uploadBackup: vi.fn(),
	createBackup: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { ref } = await import('vue');

	mocks.isPhone = ref(true);

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
		useSizeClass: () => ({
			isPhone: mocks.isPhone,
			isTabletPortrait: ref(false),
			isTabletLandscape: ref(false),
			isDesktop: ref(false),
			isTouch: ref(false),
			sizeClass: ref('phone'),
		}),
	};
});

vi.mock('../composables/useBackups', async () => {
	const { ref } = await import('vue');

	mocks.backups = ref([]);
	mocks.loading = ref(false);
	mocks.failed = ref(false);

	return {
		useBackups: () => ({
			backups: mocks.backups,
			loading: mocks.loading,
			failed: mocks.failed,
			creating: ref(false),
			fetchBackups: mocks.fetchBackups,
			createBackup: mocks.createBackup,
			deleteBackup: mocks.deleteBackup,
			restoreBackup: mocks.restoreBackup,
			downloadBackup: mocks.downloadBackup,
			uploadBackup: mocks.uploadBackup,
		}),
	};
});

const DAY = 24 * 60 * 60 * 1000;

const backup = (id: string, ageDays: number, name = `backup-${id}`): IBackup =>
	({
		id,
		name,
		version: '1.2.0',
		created_at: new Date(Date.now() - ageDays * DAY).toISOString(),
		size_bytes: 2048,
		contributions: [],
	}) as unknown as IBackup;

const mountBackups = () => mount(SystemBackups, { attachTo: document.body });

describe('SystemBackups', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.isPhone.value = true;
		mocks.backups.value = [];
		mocks.loading.value = false;
		mocks.failed.value = false;
	});

	it('reads the backups and warns while there are none', async () => {
		const wrapper = mountBackups();
		await flushPromises();

		expect(mocks.fetchBackups).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(ElAlert).props('type')).toBe('warning');
		expect(wrapper.findComponent(ElAlert).props('title')).toBe('systemModule.backups.banner.noneTitle');
		expect(wrapper.find('[data-test-id="system-backups-empty"]').exists()).toBe(true);
	});

	it('reminds when the newest backup is a month old, and is content with a recent one', async () => {
		mocks.backups.value = [backup('old', 45), backup('older', 90)];

		const wrapper = mountBackups();
		await flushPromises();

		expect(wrapper.findComponent(ElAlert).props('type')).toBe('warning');
		expect(wrapper.findComponent(ElAlert).props('title')).toBe('systemModule.backups.banner.staleTitle');

		mocks.backups.value = [backup('old', 45), backup('new', 2)];
		await flushPromises();

		expect(wrapper.findComponent(ElAlert).props('type')).toBe('success');
	});

	it('offers a retry when the backups cannot be read', async () => {
		mocks.failed.value = true;

		const wrapper = mountBackups();
		await flushPromises();

		await wrapper.get('[data-test-id="system-backups-error"] button').trigger('click');

		expect(mocks.fetchBackups).toHaveBeenCalledTimes(2);
	});

	it('shows a row per backup on phone, and filters them by the search', async () => {
		mocks.backups.value = [backup('a', 1, 'before-update'), backup('b', 2, 'weekly')];

		const wrapper = mountBackups();
		await flushPromises();

		expect(wrapper.findAll('[data-test-id="system-backups-row"]')).toHaveLength(2);

		await wrapper.get('[data-test-id="system-backups-search"]').setValue('weekly');

		expect(wrapper.findAll('[data-test-id="system-backups-row"]')).toHaveLength(1);

		await wrapper.get('[data-test-id="system-backups-search"]').setValue('nothing');

		expect(wrapper.get('[data-test-id="system-backups-empty"]').text()).toContain('systemModule.backups.noMatches');
	});

	it('deletes a backup only after a confirmation that names the action', async () => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);
		mocks.deleteBackup.mockResolvedValue(true);
		mocks.backups.value = [backup('a', 1)];

		const wrapper = mountBackups();
		await flushPromises();

		wrapper.findComponent(SystemBackupActions).vm.$emit('delete', mocks.backups.value[0]);
		await flushPromises();

		expect(confirm).toHaveBeenCalledWith(
			'systemModule.backups.deleteDialog.message',
			'systemModule.backups.deleteDialog.title',
			expect.objectContaining({ confirmButtonText: 'systemModule.backups.buttons.delete', confirmButtonClass: 'el-button--danger' })
		);
		expect(mocks.deleteBackup).toHaveBeenCalledWith('a');
	});

	it('restores a backup from its dialog', async () => {
		mocks.restoreBackup.mockResolvedValue(true);
		mocks.backups.value = [backup('a', 1)];

		const wrapper = mountBackups();
		await flushPromises();

		wrapper.findComponent(SystemBackupActions).vm.$emit('restore', mocks.backups.value[0]);
		await flushPromises();

		(document.querySelector('[data-test-id="system-backups-restore-confirm"]') as HTMLButtonElement).click();
		await flushPromises();

		expect(mocks.restoreBackup).toHaveBeenCalledWith('a');
	});

	it('uploads the picked file', async () => {
		mocks.uploadBackup.mockResolvedValue(true);

		const wrapper = mountBackups();
		await flushPromises();

		const input = wrapper.get('[data-test-id="system-backups-upload-input"]');
		const file = new File(['x'], 'backup.tar.gz');

		Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
		await input.trigger('change');
		await flushPromises();

		expect(mocks.uploadBackup).toHaveBeenCalledWith(file);
	});
});
