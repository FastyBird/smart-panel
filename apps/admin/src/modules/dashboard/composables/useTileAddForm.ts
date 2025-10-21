import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IPluginElement, deepClone, getSchemaDefaults, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { TileAddFormSchema } from '../schemas/tiles.schemas';
import type { ITileAddForm } from '../schemas/tiles.types';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { IUseTileAddForm } from './types';
import { useTilesPlugin } from './useTilesPlugin';

interface IUseTileAddFormProps {
	id: ITile['id'];
	type: IPluginElement['type'];
	parent: string;
	parentId: string;
	onlyDraft?: boolean;
}

export const useTileAddForm = <TForm extends ITileAddForm = ITileAddForm>({
	id,
	parent,
	parentId,
	type,
	onlyDraft = false,
}: IUseTileAddFormProps): IUseTileAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useTilesPlugin({ type });

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>({
		...getSchemaDefaults(element.value?.schemas?.tileAddFormSchema || TileAddFormSchema),
		id,
		type,
		row: 1,
		col: 1,
		rowSpan: 1,
		colSpan: 1,
		hidden: false,
	} as TForm);

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.tileAddFormSchema || TileAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DashboardValidationException('Failed to validate create tile model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('dashboardModule.messages.tiles.notCreated');

		try {
			await tilesStore.add({
				id,
				parent: {
					type: parent,
					id: parentId,
				},
				draft: onlyDraft,
				data: {
					...parsedModel.data,
					type,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof DashboardApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('dashboardModule.messages.tiles.created'));

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
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
	};
};
