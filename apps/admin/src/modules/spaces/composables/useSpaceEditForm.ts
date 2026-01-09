import { type ComputedRef, type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../spaces.constants';
import type { ISpace } from '../store';
import { spacesStoreKey } from '../store';

import { SpaceEditFormSchema } from './schemas';
import type { ISpaceEditForm, IUseSpaceEditForm } from './types';

interface IUseSpaceEditFormProps {
	space: ISpace | ComputedRef<ISpace>;
}

export const useSpaceEditForm = <TForm extends ISpaceEditForm = ISpaceEditForm>({
	space: spaceProp,
}: IUseSpaceEditFormProps): IUseSpaceEditForm<TForm> => {
	// Resolve the space - can be a value or a computed ref
	const getSpace = (): ISpace => {
		return 'value' in spaceProp ? spaceProp.value : spaceProp;
	};

	const space = getSpace();
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { t } = useI18n();
	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>({
		id: space.id,
		type: space.type,
		name: space.name,
		description: space.description,
		category: space.category,
		icon: space.icon,
		displayOrder: space.displayOrder,
		parentId: space.parentId,
		suggestionsEnabled: space.suggestionsEnabled,
	} as TForm);

	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new Error('Form not valid');

		const parsedModel = SpaceEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			throw new Error('Failed to validate edit space model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('spacesModule.messages.notEdited', { space: model.name });

		try {
			await spacesStore.edit({
				id: space.id,
				data: {
					name: parsedModel.data.name,
					type: parsedModel.data.type,
					category: parsedModel.data.category ?? null,
					description: parsedModel.data.description ?? null,
					icon: parsedModel.data.icon ?? null,
					displayOrder: parsedModel.data.displayOrder,
					parentId: parsedModel.data.parentId ?? null,
					suggestionsEnabled: parsedModel.data.suggestionsEnabled,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			flashMessage.error(errorMessage);

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		formChanged.value = false;

		initialModel = deepClone<Reactive<TForm>>(toRaw(model));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	// Watch for space prop changes to update model
	// Use getSpace() to reactively access the space from computed ref or track changes
	watch(
		() => getSpace(),
		(newSpace) => {
			if (newSpace) {
				model.id = newSpace.id as TForm['id'];
				model.type = newSpace.type as TForm['type'];
				model.name = newSpace.name as TForm['name'];
				model.description = newSpace.description as TForm['description'];
				model.category = newSpace.category as TForm['category'];
				model.icon = newSpace.icon as TForm['icon'];
				model.displayOrder = newSpace.displayOrder as TForm['displayOrder'];
				model.parentId = newSpace.parentId as TForm['parentId'];
				model.suggestionsEnabled = newSpace.suggestionsEnabled as TForm['suggestionsEnabled'];

				initialModel = deepClone<Reactive<TForm>>(toRaw(model));
				formChanged.value = false;
			}
		},
		{ deep: true }
	);

	return {
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
