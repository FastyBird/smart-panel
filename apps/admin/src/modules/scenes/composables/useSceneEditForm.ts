import { onBeforeUnmount, type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
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
import { scenesActionsStoreKey, scenesStoreKey } from '../store/keys';
import type { ISceneAction } from '../store/scenes.actions.store.types';
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
	const actionsStore = storesManager.getStore(scenesActionsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const { spaces, fetching: spacesLoading, fetchSpaces } = useSpaces();

	const formResult = ref<FormResultType>(FormResult.NONE);

	// Get actions from the actions store
	const sceneActions = computed(() => actionsStore.findForScene(scene.id));

	// Store original actions for comparison when saving
	const originalActions = ref<ISceneAction[]>(deepClone(sceneActions.value));

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

	// Convert scene actions to form format (spread all properties including plugin-specific ones)
	const sceneActionsAsFormData = computed(() =>
		sceneActions.value.map((action: ISceneAction) => ({
			...action,
		}))
	);

	const model = reactive<TForm>({
		id: scene.id,
		category: scene.category,
		name: scene.name,
		description: scene.description,
		enabled: scene.enabled,
		primarySpaceId: scene.primarySpaceId,
		actions: sceneActionsAsFormData.value,
	} as unknown as TForm);

	const { options: actionPluginOptions, getElement } = useScenesActionPlugins();

	const addAction = (action: ISceneActionAddForm & { type: string }): boolean => {
		// Check for duplicate action (same propertyId)
		const propertyId = (action as Record<string, unknown>).propertyId as string | undefined;

		if (propertyId) {
			const existingAction = (model as ISceneEditForm).actions.find(
				(a) => (a as Record<string, unknown>).propertyId === propertyId
			);

			if (existingAction) {
				flashMessage.warning(t('scenes.messages.duplicateAction'));
				return false;
			}
		}

		(model as ISceneEditForm).actions.push(action);
		return true;
	};

	const removeAction = (index: number): void => {
		(model as ISceneEditForm).actions.splice(index, 1);
	};

	const updateAction = (index: number, action: ISceneActionAddForm & { type: string }): void => {
		if (index >= 0 && index < (model as ISceneEditForm).actions.length) {
			(model as ISceneEditForm).actions[index] = action;
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

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	// Initialize initialModel after model is created
	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	/**
	 * Sync actions with the backend after scene update
	 */
	const syncActions = async (sceneId: string, currentActions: ISceneActionAddForm[]): Promise<void> => {
		try {
			const originalActionIds = new Set(originalActions.value.map((a: ISceneAction) => a.id));
			const currentActionIds = new Set(currentActions.filter((a) => a.id).map((a) => a.id));

			// Delete removed actions
			for (const original of originalActions.value) {
				if (!currentActionIds.has(original.id)) {
					await actionsStore.remove({ id: original.id, sceneId });
				}
			}

			// Track newly created action IDs to update model
			const newActionIds: Map<number, string> = new Map();

			// Create or update actions
			for (let i = 0; i < currentActions.length; i++) {
				const action = currentActions[i];
				const actionId = action.id;

				if (!actionId || !originalActionIds.has(actionId)) {
					// New action - create it (spread all properties including plugin-specific fields)
					const createdAction = await actionsStore.add({
						sceneId,
						data: {
							...action,
							order: i,
							enabled: action.enabled ?? true,
						},
					});
					// Track the server-assigned ID
					newActionIds.set(i, createdAction.id);
				} else {
					// Existing action - check if modified
					const original = originalActions.value.find((a: ISceneAction) => a.id === actionId);
					if (original) {
						// Compare relevant fields (excluding internal metadata)
						const internalFields = new Set(['id', 'draft', 'createdAt', 'updatedAt', 'scene']);
						const pickRelevant = (obj: Record<string, unknown>): Record<string, unknown> => {
							return Object.fromEntries(Object.entries(obj).filter(([key]) => !internalFields.has(key)));
						};
						const isModified = !isEqual(pickRelevant(original), { ...pickRelevant(action), order: i });

						if (isModified) {
							await actionsStore.edit({
								id: actionId,
								sceneId,
								data: {
									...action,
									order: i,
								},
							});
						}
					}
				}
			}

			// Update model.actions with server-assigned IDs
			for (const [index, newId] of newActionIds) {
				if ((model as ISceneEditForm).actions[index]) {
					(model as ISceneEditForm).actions[index].id = newId;
				}
			}

			// Refresh originalActions from the store to reflect current state
			originalActions.value = deepClone(actionsStore.findForScene(sceneId));
		} catch (error: unknown) {
			logger.error('Error syncing scene actions:', error);
			throw error;
		}
	};

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = scene.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: scene.draft
					? t('scenes.messages.createFailed')
					: t('scenes.messages.editFailed', { scene: scene.name });

		try {
			formEl.value!.clearValidate();

			const valid = await formEl.value!.validate();

			if (!valid) throw new ScenesValidationException('Form not valid');

			const parsedModel = SceneEditFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new ScenesValidationException('Failed to validate edit scene model.');
			}

			await scenesStore.edit({
				id: scene.id,
				data: parsedModel.data,
			});

			if (scene.draft) {
				const updatedScene = await scenesStore.save({
					id: scene.id,
				});

				// Update model with refreshed scene data
				model.id = updatedScene.id;
				model.category = updatedScene.category;
				model.name = updatedScene.name;
				model.description = updatedScene.description;
				model.enabled = updatedScene.enabled;
				model.primarySpaceId = updatedScene.primarySpaceId;
			}

			// Sync actions with backend (only for non-draft scenes)
			if (!scene.draft) {
				await syncActions(scene.id, parsedModel.data.actions);
			}
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof ScenesApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else if (!(error instanceof ScenesValidationException)) {
				// Only show error message for non-validation errors (validation is shown by form)
				flashMessage.error(errorMessage);
				logger.error('Scene edit failed:', error);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		if (isDraft) {
			flashMessage.success(t(messages && messages.success ? messages.success : 'scenes.messages.created'));

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

	onBeforeUnmount(() => {
		clear();
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
