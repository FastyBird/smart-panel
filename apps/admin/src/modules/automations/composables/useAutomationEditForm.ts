import { getCurrentScope, onScopeDispose, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../automations.constants';
import { AutomationsApiException, AutomationsRevisionConflictException, AutomationsValidationException } from '../automations.exceptions';
import type { IAutomationEditForm } from '../schemas/automations.types';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationEditForm } from './types';
import { useAutomationModes } from './useAutomationModes';

interface IUseAutomationEditFormProps {
	automation: IAutomation;
}

/**
 * Edits the basic details of an automation: its name, description, space and run mode. The flow itself
 * is never sent from here, so it stays as the backend holds it.
 */
export const useAutomationEditForm = ({ automation }: IUseAutomationEditFormProps): IUseAutomationEditForm => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const { modeOptions } = useAutomationModes();

	const formResult = ref<FormResultType>(FormResult.NONE);

	// Takes the outcome of a submit off the screen a while after it is shown
	let timer: number | undefined;

	// The record the draft was started from. The store replaces its record whenever the automation is
	// changed elsewhere, while the draft stays as it was - so a save has to name the revision the draft
	// is based on, not the one held by the store, or it would silently overwrite the other change.
	let base: IAutomation = automation;

	const model = reactive<IAutomationEditForm>({
		id: base.id,
		name: base.name,
		description: base.description ?? '',
		spaceId: base.spaceId,
		mode: base.mode,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const isChanged = (): boolean => {
		return (
			model.name !== base.name ||
			(model.description ?? '') !== (base.description ?? '') ||
			(model.spaceId ?? null) !== base.spaceId ||
			model.mode !== base.mode
		);
	};

	// Starts the draft over from the given record
	const rebase = (record: IAutomation): void => {
		base = record;

		model.name = record.name;
		model.description = record.description ?? '';
		model.spaceId = record.spaceId;
		model.mode = record.mode;

		formChanged.value = false;
	};

	// Moves the draft over a newer record without losing it: what was changed in the form stays as it
	// was typed, what was left alone follows the record - sent as it was, it would undo the other
	// change without anybody having seen it.
	const carryOver = (record: IAutomation): void => {
		if (model.name === base.name) model.name = record.name;
		if ((model.description ?? '') === (base.description ?? '')) model.description = record.description ?? '';
		if ((model.spaceId ?? null) === base.spaceId) model.spaceId = record.spaceId;
		if (model.mode === base.mode) model.mode = record.mode;

		base = record;

		formChanged.value = isChanged();
	};

	let pending: Promise<'saved'> | null = null;

	// A submit asked for while another one is on its way joins it instead of sending the update twice
	const submit = (): Promise<'saved'> => {
		if (pending === null) {
			pending = save().finally((): void => {
				pending = null;
			});
		}

		return pending;
	};

	const save = async (): Promise<'saved'> => {
		// The outcome of the previous submit is over, and so is its timer: left running it would take
		// the state of this one off the screen while it is still on its way
		clear();

		formEl.value!.clearValidate();

		// Without a callback, Element Plus rejects with the invalid fields instead of resolving false
		const valid = await formEl.value!.validate().catch((): boolean => false);

		if (!valid) throw new AutomationsValidationException('Form not valid');

		formResult.value = FormResult.WORKING;

		const name = base.name;

		let saved: IAutomation;

		try {
			saved = await automationsStore.edit({
				id: base.id,
				revision: base.revision,
				data: {
					name: model.name,
					description: model.description ?? null,
					spaceId: model.spaceId ?? null,
					mode: model.mode,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof AutomationsRevisionConflictException) {
				// The store has tried to read the automation again. When it holds a newer one, the draft
				// moves over it and stays for review: the next save is then a deliberate one over the other
				// change. When the read failed, nothing newer is known, and the next save conflicts again.
				const held = automationsStore.findById(base.id);

				if (held !== null && held.revision > base.revision) {
					carryOver(held);
				}

				flashMessage.warning(t('automations.messages.changedElsewhere', { automation: name }));
			} else if (error instanceof AutomationsApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(t('automations.messages.notEdited', { automation: name }));
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('automations.messages.edited', { automation: model.name }));

		// What was saved is what any further change is made over
		rebase(saved);

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	if (getCurrentScope()) {
		onScopeDispose((): void => window.clearTimeout(timer));
	}

	watch(model, (): void => {
		formChanged.value = isChanged();
	});

	return {
		modeOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
