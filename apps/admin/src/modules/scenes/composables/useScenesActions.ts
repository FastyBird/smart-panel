import { injectStoresManager } from '../../../common';
import { scenesStoreKey } from '../store/keys';
import type { IScene, IScenesAddActionPayload, IScenesEditActionPayload } from '../store/scenes.store.types';

interface IUseScenesActions {
	addScene: (payload: IScenesAddActionPayload) => Promise<IScene>;
	editScene: (payload: IScenesEditActionPayload) => Promise<IScene>;
	removeScene: (id: IScene['id']) => Promise<void>;
}

export const useScenesActions = (): IUseScenesActions => {
	const storesManager = injectStoresManager();
	const scenesStore = storesManager.getStore(scenesStoreKey);

	const addScene = async (payload: IScenesAddActionPayload): Promise<IScene> => {
		return scenesStore.add(payload);
	};

	const editScene = async (payload: IScenesEditActionPayload): Promise<IScene> => {
		return scenesStore.edit(payload);
	};

	const removeScene = async (id: IScene['id']): Promise<void> => {
		await scenesStore.remove({ id });
	};

	return {
		addScene,
		editScene,
		removeScene,
	};
};
