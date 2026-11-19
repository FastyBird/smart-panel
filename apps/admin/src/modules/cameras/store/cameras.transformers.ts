import { logger, snakeToCamel } from '../../../common';
import type { CamerasModuleCameraSchema } from '../../../openapi.constants';
import { CamerasValidationException } from '../cameras.exceptions';

import { CameraSchema } from './cameras.store.schemas';
import type { ICamera } from './cameras.store.types';

export const transformCameraResponse = (response: CamerasModuleCameraSchema): ICamera => {
	const parsed = CameraSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new CamerasValidationException('Failed to validate received camera data.');
	}

	return parsed.data;
};
