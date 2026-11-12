import { effectScope, nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { AutomationMode, FormResult } from '../automations.constants';
import { AutomationsApiException, AutomationsValidationException } from '../automations.exceptions';

import { useAutomationAddForm } from './useAutomationAddForm';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: vi.fn((key: string, params?: { automation?: string }) => `${key}${params?.automation ? ' ' + params.automation : ''}`),
	}),
}));

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const spaceId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

describe('useAutomationAddForm', () => {
	let mockStore: { add: Mock };

	const createFormEl = (valid: boolean = true): FormInstance =>
		({
			clearValidate: vi.fn(),
			// As Element Plus does without a callback: an invalid form rejects with its invalid fields
			validate: valid ? vi.fn().mockResolvedValue(true) : vi.fn().mockRejectedValue({ name: [{ message: 'required', field: 'name' }] }),
		}) as unknown as FormInstance;

	beforeEach(() => {
		vi.useFakeTimers();

		vi.clearAllMocks();

		mockStore = { add: vi.fn() };

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockStore),
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with an empty form in restart mode', () => {
		const { model, formChanged, formResult, modeOptions } = useAutomationAddForm({ id: automationId });

		expect(model).toEqual({ id: automationId, name: '', description: '', spaceId: null, mode: AutomationMode.restart });
		expect(formChanged.value).toBe(false);
		expect(formResult.value).toBe(FormResult.NONE);
		expect(modeOptions.value.map((option) => option.value)).toEqual([AutomationMode.single, AutomationMode.restart, AutomationMode.parallel]);
		expect(modeOptions.value[0]).toMatchObject({ label: 'automations.modes.single.title', description: 'automations.modes.single.description' });
	});

	it('notices a changed form', async () => {
		const { model, formChanged } = useAutomationAddForm({ id: automationId });

		model.name = 'Night mode';

		await nextTick();

		expect(formChanged.value).toBe(true);

		model.name = '';

		await nextTick();

		expect(formChanged.value).toBe(false);
	});

	it('creates the automation', async () => {
		const { model, formEl, formResult, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl();

		model.name = 'Night mode';
		model.description = 'Dims everything';
		model.spaceId = spaceId;
		model.mode = AutomationMode.single;

		await expect(submit()).resolves.toBe('added');

		expect(mockStore.add).toHaveBeenCalledWith({
			id: automationId,
			data: { name: 'Night mode', description: 'Dims everything', spaceId, mode: AutomationMode.single },
		});
		expect(formResult.value).toBe(FormResult.OK);
		expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.created Night mode');

		vi.advanceTimersByTime(2000);

		expect(formResult.value).toBe(FormResult.NONE);
	});

	it('creates the automation once when it is submitted again before the first one has finished', async () => {
		let resolve: (value: unknown) => void = () => {};

		mockStore.add.mockReturnValue(
			new Promise((res) => {
				resolve = res;
			})
		);

		const { model, formEl, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl();

		model.name = 'Night mode';

		const first = submit();
		const second = submit();

		// Also once the first one is past the validation and waits for the backend
		await vi.advanceTimersByTimeAsync(0);

		const third = submit();

		resolve(undefined);

		await expect(Promise.all([first, second, third])).resolves.toEqual(['added', 'added', 'added']);

		expect(mockStore.add).toHaveBeenCalledTimes(1);
		expect(mockFlash.success).toHaveBeenCalledTimes(1);
	});

	it('does not let the timer of a failed save take the state of its retry off the screen', async () => {
		mockStore.add.mockRejectedValueOnce(new AutomationsApiException('Failed', 500));

		const { model, formEl, formResult, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl();

		model.name = 'Night mode';

		await expect(submit()).rejects.toThrow(AutomationsApiException);

		expect(formResult.value).toBe(FormResult.ERROR);

		await vi.advanceTimersByTimeAsync(1500);

		let resolve: (value: unknown) => void = () => {};

		mockStore.add.mockReturnValue(
			new Promise((res) => {
				resolve = res;
			})
		);

		const retry = submit();

		// Past the moment the first outcome would have been cleared
		await vi.advanceTimersByTimeAsync(1000);

		expect(formResult.value).toBe(FormResult.WORKING);

		resolve(undefined);

		await retry;

		// And the outcome of the retry stays for its own two seconds
		await vi.advanceTimersByTimeAsync(1500);

		expect(formResult.value).toBe(FormResult.OK);

		await vi.advanceTimersByTimeAsync(500);

		expect(formResult.value).toBe(FormResult.NONE);
	});

	it('stops its timer together with the component', async () => {
		mockStore.add.mockRejectedValue(new AutomationsApiException('Failed', 500));

		const scope = effectScope();

		const { model, formEl, formResult, submit } = scope.run(() => useAutomationAddForm({ id: automationId }))!;

		formEl.value = createFormEl();

		model.name = 'Night mode';

		await expect(submit()).rejects.toThrow(AutomationsApiException);

		scope.stop();

		expect(vi.getTimerCount()).toBe(0);
		expect(formResult.value).toBe(FormResult.ERROR);
	});

	it('does not call the store for a form that is not valid', async () => {
		const { formEl, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl(false);

		await expect(submit()).rejects.toThrow(AutomationsValidationException);

		expect(mockStore.add).not.toHaveBeenCalled();
	});

	it('shows the reason of a refused request', async () => {
		mockStore.add.mockRejectedValue(new AutomationsApiException('Space does not exist', 422));

		const { model, formEl, formResult, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl();

		model.name = 'Night mode';

		await expect(submit()).rejects.toThrow(AutomationsApiException);

		expect(formResult.value).toBe(FormResult.ERROR);
		expect(mockFlash.error).toHaveBeenCalledWith('Space does not exist');
	});

	it('shows a general message for any other failure', async () => {
		mockStore.add.mockRejectedValue(new AutomationsApiException('Failed', 500));

		const { model, formEl, submit } = useAutomationAddForm({ id: automationId });

		formEl.value = createFormEl();

		model.name = 'Night mode';

		await expect(submit()).rejects.toThrow(AutomationsApiException);

		expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notCreated Night mode');
	});
});
