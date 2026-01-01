import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { SPACE_CATEGORY_TEMPLATES, SpaceType } from '../../spaces/spaces.constants';
import { SceneEditFormSchema } from '../schemas/scenes.schemas';
import type { ISceneActionAddForm, ISceneEditForm } from '../schemas/scenes.types';
import { FormResult, type FormResultType, SCENE_CATEGORY_ICONS, SceneCategory } from '../scenes.constants';
import { ScenesApiException, ScenesValidationException } from '../scenes.exceptions';
import { scenesStoreKey } from '../store/keys';
import type { IScene } from '../store/scenes.store.types';

import type { ISpaceOptionGroup, IUseSceneEditForm } from './types';
import { useScenesActionPlugins } from './useScenesActionPlugins';

interface IUseSceneEditFormProps {
	scene: IScene;
	messages?: { success?: string; error?: string };
}

export const useSceneEditForm = <TForm extends ISceneEditForm = ISceneEditForm>({
	scene,
	messages,
}: IUseSceneEditFormProps): IUseSceneEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);

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

	// Convert scene actions to form format
	const sceneActionsAsFormData = scene.actions.map((action) => ({
		id: action.id,
		type: action.type,
		deviceId: action.deviceId,
		channelId: action.channelId,
		propertyId: action.propertyId,
		value: action.value,
		order: action.order,
		enabled: action.enabled,
	}));

	const model = reactive<TForm>({
		id: scene.id,
		category: scene.category,
		name: scene.name,
		description: scene.description,
		enabled: scene.enabled,
		primarySpaceId: scene.primarySpaceId,
		actions: sceneActionsAsFormData,
	} as TForm);

	const { options: actionPluginOptions, getElement } = useScenesActionPlugins();

	const addAction = (action: ISceneActionAddForm & { type: string }): void => {
		(model as ISceneEditForm).actions.push(action);
	};

	const removeAction = (index: number): void => {
		(model as ISceneEditForm).actions.splice(index, 1);
	};

	const getActionCardComponent = (type: string) => {
		const element = getElement(type);
		return element?.components?.sceneActionCard ?? null;
	};

	const getActionFormComponent = (type: string) => {
		const element = getElement(type);
		return element?.components?.sceneActionAddForm ?? null;
	};

	const getPluginLabel = (type: string): string => {
		const option = actionPluginOptions.value.find((o) => o.value === type);
		return option?.label ?? type;
	};

	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = scene.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: scene.draft
					? t('scenes.messages.createFailed')
					: t('scenes.messages.editFailed', { scene: scene.name });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ScenesValidationException('Form not valid');

		const parsedModel = SceneEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new ScenesValidationException('Failed to validate edit scene model.');
		}

		try {
			await scenesStore.edit({
				id: scene.id,
				data: parsedModel.data,
			});

			if (scene.draft) {
				await scenesStore.save({
					id: scene.id,
				});
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

		if (isDraft) {
			flashMessage.success(
				t(messages && messages.success ? messages.success : 'scenes.messages.created')
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'scenes.messages.edited', {
				scene: scene.name,
			})
		);

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
		getActionCardComponent,
		getActionFormComponent,
		getPluginLabel,
	};
};
