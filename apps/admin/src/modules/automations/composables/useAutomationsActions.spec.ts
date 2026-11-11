import { ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { ElMessageBox } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	AutomationsApiException,
	AutomationsException,
	AutomationsGraphInvalidException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';

import { useAutomationsActions } from './useAutomationsActions';

const mockAutomation = { id: '2', name: 'Hallway motion light' };

const mockStore = {
	findById: vi.fn((id: string) => (id === '2' ? mockAutomation : null)),
	remove: vi.fn(),
	edit: vi.fn(),
	semaphore: ref({ fetching: { items: false, item: [] }, creating: [], updating: ['2'], deleting: [] }),
};

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
};

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: vi.fn(),
		},
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => mockStore,
		}),
		useFlashMessage: () => mockFlash,
	};
});

describe('useAutomationsActions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());

		vi.clearAllMocks();

		(ElMessageBox.confirm as Mock).mockResolvedValue(undefined);
	});

	it('exposes the automations being updated', () => {
		const { updating } = useAutomationsActions();

		expect(updating.value).toEqual(['2']);
	});

	describe('remove', () => {
		it('throws when the automation is not known', async () => {
			const { remove } = useAutomationsActions();

			await expect(remove('1')).rejects.toThrow(AutomationsException);
			expect(ElMessageBox.confirm).not.toHaveBeenCalled();
		});

		it('removes the automation once confirmed', async () => {
			const { remove } = useAutomationsActions();

			await remove('2');

			expect(mockStore.remove).toHaveBeenCalledWith({ id: '2' });
			expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.removed');
		});

		it('does not remove anything when the confirmation is declined', async () => {
			(ElMessageBox.confirm as Mock).mockRejectedValue('cancel');

			const { remove } = useAutomationsActions();

			await remove('2');

			expect(mockStore.remove).not.toHaveBeenCalled();
			expect(mockFlash.info).toHaveBeenCalledWith('automations.messages.removeCanceled');
		});

		it('reports a failed removal', async () => {
			mockStore.remove.mockRejectedValueOnce(new AutomationsApiException('Failed', 500));

			const { remove } = useAutomationsActions();

			await remove('2');

			expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notRemoved');
			expect(mockFlash.success).not.toHaveBeenCalled();
		});
	});

	describe('setEnabled', () => {
		it('throws when the automation is not known', async () => {
			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('1', true)).rejects.toThrow(AutomationsException);
		});

		it('enables the automation', async () => {
			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('2', true)).resolves.toBe(true);

			expect(mockStore.edit).toHaveBeenCalledWith({ id: '2', data: { enabled: true } });
			expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.enabled');
		});

		it('disables the automation', async () => {
			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('2', false)).resolves.toBe(true);

			expect(mockStore.edit).toHaveBeenCalledWith({ id: '2', data: { enabled: false } });
			expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.disabled');
		});

		it('says so when the automation was changed elsewhere', async () => {
			mockStore.edit.mockRejectedValueOnce(new AutomationsRevisionConflictException('Conflict'));

			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('2', true)).resolves.toBe(false);

			expect(mockFlash.warning).toHaveBeenCalledWith('automations.messages.changedElsewhere');
			expect(mockFlash.error).not.toHaveBeenCalled();
		});

		it('says so when the flow is not complete enough to be enabled', async () => {
			mockStore.edit.mockRejectedValueOnce(new AutomationsGraphInvalidException('Invalid graph'));

			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('2', true)).resolves.toBe(false);

			expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notEnabledIncomplete');
		});

		it('reports any other failure by the direction of the change', async () => {
			mockStore.edit.mockRejectedValue(new AutomationsApiException('Failed', 500));

			const { setEnabled } = useAutomationsActions();

			await expect(setEnabled('2', true)).resolves.toBe(false);
			await expect(setEnabled('2', false)).resolves.toBe(false);

			expect(mockFlash.error).toHaveBeenNthCalledWith(1, 'automations.messages.notEnabled');
			expect(mockFlash.error).toHaveBeenNthCalledWith(2, 'automations.messages.notDisabled');

			mockStore.edit.mockReset();
		});
	});
});
