import { logger, snakeToCamel } from '../../../common';
import { DevicesValidationException } from '../devices.exceptions';

import { DeviceValidationResultSchema, DevicesValidationSchema } from './devices.validation.store.schemas';
import type { IDeviceValidationResult, IDeviceValidationResultRes, IDevicesValidation, IDevicesValidationRes } from './devices.validation.store.types';

export const transformDevicesValidationResponse = (response: IDevicesValidationRes): IDevicesValidation => {
	const parsed = DevicesValidationSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate received devices validation data.');
	}

	return parsed.data;
};

export const transformDeviceValidationResultResponse = (response: IDeviceValidationResultRes): IDeviceValidationResult => {
	const parsed = DeviceValidationResultSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate received device validation result data.');
	}

	return parsed.data;
};
