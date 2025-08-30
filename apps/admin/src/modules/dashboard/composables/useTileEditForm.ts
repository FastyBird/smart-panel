import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { TileEditFormSchema } from '../schemas/tiles.schemas';
import type { ITileEditForm } from '../schemas/tiles.types';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { IUseTileEditForm } from './types';
import { useTilesPlugin } from './useTilesPlugin';

interface IUseTileEditFormProps {
	tile: ITile;
	messages?: { success?: string; error?: string };
	onlyDraft?: boolean;
}

export const useTileEditForm = <TForm extends ITileEditForm = ITileEditForm>({
	tile,
	messages,
	onlyDraft = false,
}: IUseTileEditFormProps): IUseTileEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useTilesPlugin({ type: tile.type });

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>(tile as unknown as TForm);

	let initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = tile.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: tile.draft && !onlyDraft
					? t('dashboardModule.messages.tiles.notCreated')
					: t('dashboardModule.messages.tiles.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.tileEditFormSchema || TileEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

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

			if (tile.draft && !onlyDraft) {
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

		if (isDraft && !onlyDraft) {
			flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.tiles.created'));

			return 'added';
		}

		flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.tiles.edited'));

		formChanged.value = false;

		initialModel = cloneDeep<Reactive<TForm>>(toRaw(model));

		return 'saved';
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
