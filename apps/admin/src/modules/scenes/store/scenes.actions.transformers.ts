import { snakeToCamel } from '../../../common';

import { SceneActionResSchema, SceneActionSchema } from './scenes.actions.store.schemas';
import type { ISceneAction, ISceneActionRes } from './scenes.actions.store.types';

export const transformSceneActionResponse = (response: ISceneActionRes): ISceneAction => {
	const parsed = SceneActionResSchema.safeParse(response);

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new Error('Failed to validate scene action response data');
	}

	// Convert all fields from snake_case to camelCase (including plugin-specific fields)
	const camelCased = snakeToCamel<ISceneActionRes>(response);

	const storeData = SceneActionSchema.safeParse({
		...camelCased,
		draft: false,
	});

	if (!storeData.success) {
		console.error('Schema validation failed with:', storeData.error);

		throw new Error('Failed to transform scene action response data');
	}

	return storeData.data;
};
