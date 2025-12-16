import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
import { ShellyV1DeviceInfoRequestSchema, ShellyV1DeviceInfoSchema, ShellyV1SupportedDeviceSchema } from '../schemas/devices.schemas';
import type { IShellyV1DeviceInfo, IShellyV1DeviceInfoRequest, IShellyV1SupportedDevice } from '../schemas/devices.types';

export const transformSupportedDevicesResponse = (response: object[]): IShellyV1SupportedDevice[] => {
	const devices = [];

	for (const row of response) {
		const parsed = ShellyV1SupportedDeviceSchema.safeParse(snakeToCamel(row));

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DevicesShellyV1ValidationException('Failed to validate received supported device data.');
		}

		devices.push(parsed.data);
	}

	return devices;
};

export const transformDeviceInfoResponse = (response: object): IShellyV1DeviceInfo => {
	const parsed = ShellyV1DeviceInfoSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesShellyV1ValidationException('Failed to validate received device info data.');
	}

	return parsed.data;
};

export const transformDeviceInfoRequest = (data: object): IShellyV1DeviceInfoRequest => {
	const parsed = ShellyV1DeviceInfoRequestSchema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesShellyV1ValidationException('Failed to validate get device info request.');
	}

	return parsed.data;
};
