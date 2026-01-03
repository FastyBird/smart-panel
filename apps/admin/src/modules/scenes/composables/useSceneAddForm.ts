import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { SPACE_CATEGORY_TEMPLATES, SpaceType } from '../../spaces/spaces.constants';
import { SceneAddFormSchema } from '../schemas/scenes.schemas';
import type { ISceneActionAddForm, ISceneAddForm } from '../schemas/scenes.types';
import { FormResult, type FormResultType, SCENE_CATEGORY_ICONS, SceneCategory } from '../scenes.constants';
import { ScenesApiException, ScenesValidationException } from '../scenes.exceptions';
import { scenesActionsStoreKey, scenesStoreKey } from '../store/keys';
import type { IScene } from '../store/scenes.store.types';

import type { ISpaceOptionGroup, IUseSceneAddForm } from './types';
import { useScenesActionPlugins } from './useScenesActionPlugins';

interface IUseSceneAddFormProps {
	id: IScene['id'];
}

export const useSceneAddForm = <TForm extends ISceneAddForm = ISceneAddForm>({ id }: IUseSceneAddFormProps): IUseSceneAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);
	const actionsStore = storesManager.getStore(scenesActionsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const { spaces, fetching: spacesLoading, fetchSpaces } = useSpaces();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions = computed(() =>
		Object.values(SceneCategory).map((value) => ({
			value,
			label: t(`scenes.categories.${value}`),
			icon: SCENE_CATEGORY_ICONS[value],
		}))
	);

	const getSpaceIcon = (space: (typeof spaces.value)[0]): string => {
		// Use custom icon if available
		if (space.icon) {
			return space.icon;
		}
		// Use category template icon if category is set
		if (space.category && SPACE_CATEGORY_TEMPLATES[space.category]) {
			return SPACE_CATEGORY_TEMPLATES[space.category].icon;
		}
		// Default icons based on type
		return space.type === SpaceType.ROOM ? 'mdi:door' : 'mdi:map-marker-radius';
	};

	const spacesOptionsGrouped = computed<ISpaceOptionGroup[]>(() => {
		const rooms = spaces.value
			.filter((space) => space.type === SpaceType.ROOM)
			.map((space) => ({
				value: space.id,
				label: space.name,
				icon: getSpaceIcon(space),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));

		const zones = spaces.value
			.filter((space) => space.type === SpaceType.ZONE)
			.map((space) => ({
				value: space.id,
				label: space.name,
				icon: getSpaceIcon(space),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));

		const groups: ISpaceOptionGroup[] = [];

		if (rooms.length > 0) {
			groups.push({
				type: SpaceType.ROOM,
				label: t('scenes.form.spaceGroups.rooms'),
				icon: 'mdi:door',
				options: rooms,
			});
		}

		if (zones.length > 0) {
			groups.push({
				type: SpaceType.ZONE,
				label: t('scenes.form.spaceGroups.zones'),
				icon: 'mdi:map-marker-radius',
				options: zones,
			});
		}

		return groups;
	});

	const model = reactive<TForm>({
		id,
		category: SceneCategory.GENERIC,
		name: '',
		description: null,
		enabled: true,
		primarySpaceId: null,
		actions: [],
	} as unknown as TForm);

	const { options: actionPluginOptions, getElement } = useScenesActionPlugins();

	const addAction = (action: ISceneActionAddForm & { type: string }): boolean => {
		// Check for duplicate action (same propertyId)
		const propertyId = (action as Record<string, unknown>).propertyId as string | undefined;

		if (propertyId) {
			const existingAction = (model as ISceneAddForm).actions.find(
				(a) => (a as Record<string, unknown>).propertyId === propertyId
			);

			if (existingAction) {
				flashMessage.warning(t('scenes.messages.duplicateAction'));
				return false;
			}
		}

		(model as ISceneAddForm).actions.push(action);
		return true;
	};

	const removeAction = (index: number): void => {
		(model as ISceneAddForm).actions.splice(index, 1);
	};

	const updateAction = (index: number, action: ISceneActionAddForm & { type: string }): void => {
		if (index >= 0 && index < (model as ISceneAddForm).actions.length) {
			(model as ISceneAddForm).actions[index] = action;
		}
	};

	const getActionCardComponent = (type: string) => {
		const element = getElement(type);
		return element?.components?.sceneActionCard ?? null;
	};

	const getActionFormComponent = (type: string) => {
		const element = getElement(type);
		return element?.components?.sceneActionAddForm ?? null;
	};

	const getActionEditFormComponent = (type: string) => {
		const element = getElement(type);
		return element?.components?.sceneActionEditForm ?? null;
	};

	const getPluginLabel = (type: string): string => {
		const option = actionPluginOptions.value.find((o) => o.value === type);
		return option?.label ?? type;
	};

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	/**
	 * Sync actions with the backend after scene creation
	 */
	const syncActions = async (sceneId: string, actions: ISceneActionAddForm[]): Promise<void> => {
		try {
			// Create all actions for the new scene
			for (let i = 0; i < actions.length; i++) {
				const action = actions[i];

				await actionsStore.add({
					sceneId,
					data: {
						...action,
						order: i,
						enabled: action.enabled ?? true,
					},
				});
			}
		} catch (error: unknown) {
			logger.error('Error syncing scene actions:', error);
			throw error;
		}
	};

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ScenesValidationException('Form not valid');

		const parsedModel = SceneAddFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new ScenesValidationException('Failed to validate create scene model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('scenes.messages.createFailed');

		try {
			const scene = await scenesStore.add({
				id,
				draft: false,
				data: parsedModel.data,
			});

			// Sync actions with backend after scene is created
			if (parsedModel.data.actions.length > 0) {
				await syncActions(scene.id, parsedModel.data.actions);
			}
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof ScenesApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('scenes.messages.created'));

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
		categoriesOptions,
		spacesOptionsGrouped,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
		loadingSpaces: spacesLoading,
		fetchSpaces,
		// Action management
		actionPluginOptions,
		addAction,
		removeAction,
		updateAction,
		getActionCardComponent,
		getActionFormComponent,
		getActionEditFormComponent,
		getPluginLabel,
	};
};
