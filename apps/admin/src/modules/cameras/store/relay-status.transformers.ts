import { logger, snakeToCamel } from '../../../common';
import type { CamerasModuleStatusSchema } from '../../../openapi.constants';
import { CamerasValidationException } from '../cameras.exceptions';

import type { IRelayStatus } from './relay-status.store';
import { RelayStatusSchema } from './relay-status.store.schemas';

export const transformRelayStatusResponse = (response: CamerasModuleStatusSchema): IRelayStatus => {
	const parsed = RelayStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new CamerasValidationException('Failed to validate received relay status.');
	}

	return parsed.data;
};
