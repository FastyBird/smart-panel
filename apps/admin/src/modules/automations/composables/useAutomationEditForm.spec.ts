import { nextTick } from 'vue';

import type { FormInstance } from 'element-plus';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { AutomationMode, AutomationStatus, FormResult } from '../automations.constants';
import { AutomationsApiException, AutomationsRevisionConflictException, AutomationsValidationException } from '../automations.exceptions';
import type { IAutomation } from '../store/automations.store.types';

import { useAutomationEditForm } from './useAutomationEditForm';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
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

const spaceId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

describe('useAutomationEditForm', () => {
	let mockStore: { edit: Mock; findById: Mock };
	let automation: IAutomation;

	const createFormEl = (valid: boolean = true): FormInstance =>
		({
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(valid),
		}) as unknown as FormInstance;

	beforeEach(() => {
		vi.useFakeTimers();

		vi.clearAllMocks();

		mockStore = { edit: vi.fn(), findById: vi.fn(() => null) };

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockStore),
		});

		automation = {
			id: 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01',
			name: 'Hallway motion light',
			description: null,
			icon: null,
			enabled: true,
			spaceId,
			mode: AutomationMode.restart,
			graph: null,
			revision: 2,
			status: AutomationStatus.ok,
			lastTriggeredAt: null,
			lastRunStatus: null,
			createdAt: new Date(),
			updatedAt: null,
		};

		mockStore.edit.mockImplementation(
			async ({ data }: { data: Partial<IAutomation> }): Promise<IAutomation> => ({
				...automation,
				...data,
				description: data.description || null,
				revision: automation.revision + 1,
			})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts from the automation', () => {
		const { model, formChanged, formResult } = useAutomationEditForm({ automation });

		expect(model).toEqual({ id: automation.id, name: 'Hallway motion light', description: '', spaceId, mode: AutomationMode.restart });
		expect(formChanged.value).toBe(false);
		expect(formResult.value).toBe(FormResult.NONE);
	});

	it('notices a change and its undoing', async () => {
		const { model, formChanged } = useAutomationEditForm({ automation });

		model.spaceId = null;

		await nextTick();

		expect(formChanged.value).toBe(true);

		model.spaceId = spaceId;

		await nextTick();

		expect(formChanged.value).toBe(false);
	});

	it('saves the basic details and never the flow', async () => {
		const { model, formEl, formResult, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		model.name = 'Hallway light';
		model.spaceId = null;
		model.mode = AutomationMode.parallel;

		await expect(submit()).resolves.toBe('saved');

		expect(mockStore.edit).toHaveBeenCalledWith({
			id: automation.id,
			revision: 2,
			data: { name: 'Hallway light', description: '', spaceId: null, mode: AutomationMode.parallel },
		});
		expect(formResult.value).toBe(FormResult.OK);
		expect(mockFlash.success).toHaveBeenCalledWith('automations.messages.edited Hallway light');

		vi.advanceTimersByTime(2000);

		expect(formResult.value).toBe(FormResult.NONE);
	});

	it('saves against the revision the draft was started from, whatever the store holds by then', async () => {
		const { model, formEl, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		// Somebody else changes the description; the store replaces its record, the draft knows nothing
		mockStore.findById.mockReturnValue({ ...automation, description: 'Changed elsewhere', revision: 3 });

		model.name = 'Hallway light';

		await submit();

		expect(mockStore.edit).toHaveBeenCalledWith(expect.objectContaining({ id: automation.id, revision: 2 }));
	});

	it('starts the draft over from the reloaded automation after a conflict', async () => {
		const { model, formEl, formChanged, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		model.name = 'Hallway light';

		await nextTick();

		expect(formChanged.value).toBe(true);

		// The store reads the automation again before it reports the conflict
		mockStore.edit.mockImplementationOnce(async (): Promise<never> => {
			mockStore.findById.mockReturnValue({ ...automation, description: 'Changed elsewhere', revision: 3 });

			throw new AutomationsRevisionConflictException('Conflict');
		});

		await expect(submit()).rejects.toThrow(AutomationsRevisionConflictException);

		expect(model).toEqual({
			id: automation.id,
			name: 'Hallway motion light',
			description: 'Changed elsewhere',
			spaceId,
			mode: AutomationMode.restart,
		});
		expect(formChanged.value).toBe(false);

		model.name = 'Hallway light';

		await submit();

		expect(mockStore.edit).toHaveBeenLastCalledWith({
			id: automation.id,
			revision: 3,
			data: { name: 'Hallway light', description: 'Changed elsewhere', spaceId, mode: AutomationMode.restart },
		});
	});

	it('bases a further save on what the previous one returned', async () => {
		const { model, formEl, formChanged, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		model.name = 'Hallway light';

		await submit();

		expect(formChanged.value).toBe(false);

		model.name = 'Hallway';

		await submit();

		expect(mockStore.edit).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 3 }));
	});

	it('sends one update when it is submitted again before the first one has finished', async () => {
		let resolve: (value: IAutomation) => void = () => {};

		mockStore.edit.mockReturnValue(
			new Promise<IAutomation>((res) => {
				resolve = res;
			})
		);

		const { model, formEl, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		model.name = 'Hallway light';

		const first = submit();
		const second = submit();

		// Also once the first one is past the validation and waits for the backend
		await vi.advanceTimersByTimeAsync(0);

		const third = submit();

		resolve({ ...automation, name: 'Hallway light', revision: 3 });

		await expect(Promise.all([first, second, third])).resolves.toEqual(['saved', 'saved', 'saved']);

		expect(mockStore.edit).toHaveBeenCalledTimes(1);
		expect(mockFlash.success).toHaveBeenCalledTimes(1);

		// The next one is a submit of its own again
		await submit();

		expect(mockStore.edit).toHaveBeenCalledTimes(2);
	});

	it('does not call the store for a form that is not valid', async () => {
		const { formEl, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl(false);

		await expect(submit()).rejects.toThrow(AutomationsValidationException);

		expect(mockStore.edit).not.toHaveBeenCalled();
	});

	it('says so when the automation was changed elsewhere', async () => {
		mockStore.edit.mockRejectedValue(new AutomationsRevisionConflictException('Conflict'));

		const { formEl, formResult, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		await expect(submit()).rejects.toThrow(AutomationsRevisionConflictException);

		expect(formResult.value).toBe(FormResult.ERROR);
		expect(mockFlash.warning).toHaveBeenCalledWith('automations.messages.changedElsewhere Hallway motion light');
		expect(mockFlash.error).not.toHaveBeenCalled();
	});

	it('shows the reason of a refused request', async () => {
		mockStore.edit.mockRejectedValue(new AutomationsApiException('Space does not exist', 422));

		const { formEl, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		await expect(submit()).rejects.toThrow(AutomationsApiException);

		expect(mockFlash.error).toHaveBeenCalledWith('Space does not exist');
	});

	it('shows a general message for any other failure', async () => {
		mockStore.edit.mockRejectedValue(new Error('offline'));

		const { formEl, submit } = useAutomationEditForm({ automation });

		formEl.value = createFormEl();

		await expect(submit()).rejects.toThrow('offline');

		expect(mockFlash.error).toHaveBeenCalledWith('automations.messages.notEdited Hallway motion light');
	});
});
