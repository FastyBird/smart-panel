import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { TileUpdateSchema } from '../schemas/tiles.schemas';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { ITileEditForm, IUseTileEditForm } from './types';
import { useTilesPlugin } from './useTilesPlugin';

interface IUseTileEditFormProps {
	tile: ITile;
	messages?: { success?: string; error?: string };
}

export const useTileEditForm = ({ tile, messages }: IUseTileEditFormProps): IUseTileEditForm => {
	const storesManager = injectStoresManager();

	const { plugin } = useTilesPlugin({ type: tile.type });

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<ITileEditForm>({
		id: tile.id,
		type: tile.type,
		row: tile.row,
		col: tile.col,
		rowSpan: tile.rowSpan ?? 0,
		colSpan: tile.colSpan ?? 0,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = tile.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: tile.draft
					? t('dashboardModule.messages.tiles.notCreated')
					: t('dashboardModule.messages.tiles.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.tileEditSchema || TileUpdateSchema).safeParse(model);

		if (!parsedModel.success) {
			throw new DashboardValidationException('Failed to validate create tile model.');
		}

		try {
			await tilesStore.edit({
				id: tile.id,
				parent: tile.parent,
				data: {
					...parsedModel.data,
					type: tile.type,
				},
			});

			if (tile.draft) {
				await tilesStore.save({
					id: tile.id,
					parent: tile.parent,
				});
			}
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

		if (isDraft) {
			flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.tiles.created'));

			return 'added';
		}

		flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.tiles.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: ITileEditForm): void => {
		if (val.row !== tile.row) {
			formChanged.value = true;
		} else if (val.col !== tile.col) {
			formChanged.value = true;
		} else if (val.rowSpan !== tile.rowSpan) {
			formChanged.value = true;
		} else if (val.colSpan !== tile.colSpan) {
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
