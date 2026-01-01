import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { SCENE_CATEGORY_ICONS, SceneCategory } from '../scenes.constants';
import { scenesStoreKey } from '../store/keys';
import type { IScene } from '../store/scenes.store.types';

import type { IUseSceneIcon } from './types';

interface IUseSceneIconProps {
	id: IScene['id'];
}

export const useSceneIcon = ({ id }: IUseSceneIconProps): IUseSceneIcon => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);

	const icon = computed<string>((): string => {
		const scene = scenesStore.findById(id);

		// Use category-based icon
		if (scene?.category && scene.category in SCENE_CATEGORY_ICONS) {
			return SCENE_CATEGORY_ICONS[scene.category];
		}

		// Default icon
		return SCENE_CATEGORY_ICONS[SceneCategory.GENERIC];
	});

	return {
		icon,
	};
};
