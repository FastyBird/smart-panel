import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { TileCreateSchema } from '../schemas/tiles.schemas';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { ITileAddForm, IUseTileAddForm } from './types';
import { useTilesPlugin } from './useTilesPlugin';

interface IUseTileAddFormProps {
	id: ITile['id'];
	type: IPlugin['type'];
	parent: string;
	parentId: string;
}

export const useTileAddForm = ({ id, parent, parentId, type }: IUseTileAddFormProps): IUseTileAddForm => {
	const storesManager = injectStoresManager();

	const { plugin } = useTilesPlugin({ type });

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<ITileAddForm>({
		id,
		type,
		row: 0,
		col: 0,
		rowSpan: 1,
		colSpan: 1,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.tileCreateSchema || TileCreateSchema).safeParse(model);

		if (!parsedModel.success) {
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
				draft: false,
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

	watch(model, (val: ITileAddForm): void => {
		if (val.type !== '') {
			formChanged.value = true;
		} else if (val.row !== 0) {
			formChanged.value = true;
		} else if (val.col !== 0) {
			formChanged.value = true;
		} else if (val.rowSpan !== 1) {
			formChanged.value = true;
		} else if (val.colSpan !== 1) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
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
