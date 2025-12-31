import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, SpaceType } from '../spaces.constants';
import { spacesStoreKey, type ISpace } from '../store';

import { SpaceAddFormSchema } from './schemas';
import type { ISpaceAddForm, IUseSpaceAddForm } from './types';

interface IUseSpaceAddFormProps {
	id: string;
}

export const useSpaceAddForm = <TForm extends ISpaceAddForm = ISpaceAddForm>({
	id,
}: IUseSpaceAddFormProps): IUseSpaceAddForm<TForm> => {
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { t } = useI18n();
	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);
	const createdSpace = ref<ISpace | null>(null);

	let timer: number;

	const model = reactive<TForm>({
		id,
		type: SpaceType.ROOM,
		name: '',
		description: null,
		category: null,
		icon: null,
		displayOrder: 0,
		parentId: null,
	} as TForm);

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new Error('Form not valid');

		const parsedModel = SpaceAddFormSchema.safeParse(model);

		if (!parsedModel.success) {
			throw new Error('Failed to validate create space model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('spacesModule.messages.notCreated', { space: model.name });

		try {
			createdSpace.value = await spacesStore.add({
				id,
				data: {
					name: parsedModel.data.name,
					type: parsedModel.data.type,
					category: parsedModel.data.category ?? null,
					description: parsedModel.data.description ?? null,
					icon: parsedModel.data.icon ?? null,
					displayOrder: parsedModel.data.displayOrder,
					parentId: parsedModel.data.parentId ?? null,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;
			createdSpace.value = null;

			timer = window.setTimeout(clear, 2000);

			flashMessage.error(errorMessage);

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(
			t('spacesModule.messages.created', {
				space: model.name,
			})
		);

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
		createdSpace.value = null;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	return {
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
		createdSpace,
	};
};
