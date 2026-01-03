import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ScenesValidationException } from '../scenes.exceptions';

import { SceneCreateReqSchema, SceneSchema, SceneUpdateReqSchema } from './scenes.store.schemas';
import type {
	IScene,
	ISceneCreateReq,
	ISceneRes,
	ISceneUpdateReq,
	IScenesAddActionPayload,
	IScenesEditActionPayload,
} from './scenes.store.types';

export const transformSceneResponse = <T extends IScene = IScene>(response: ISceneRes, schema: typeof SceneSchema): T => {
	const camelCaseResponse = snakeToCamel(response);

	const parsed = schema.safeParse(camelCaseResponse);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ScenesValidationException('Failed to validate received scene data.');
	}

	return parsed.data as T;
};

export const transformSceneCreateRequest = <T extends ISceneCreateReq = ISceneCreateReq>(
	data: IScenesAddActionPayload['data'],
	schema: typeof SceneCreateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ScenesValidationException('Failed to validate create scene request.');
	}

	return parsed.data as T;
};

export const transformSceneUpdateRequest = <T extends ISceneUpdateReq = ISceneUpdateReq>(
	data: IScenesEditActionPayload['data'],
	schema: typeof SceneUpdateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ScenesValidationException('Failed to validate update scene request.');
	}

	return parsed.data as T;
};
