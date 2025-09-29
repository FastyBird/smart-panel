import { camelToSnake, snakeToCamel } from '../../../common';
import { DevicesShellyNgValidationException } from '../devices-shelly-ng.exceptions';
import { ShellyNgDeviceInfoRequestSchema, ShellyNgDeviceInfoSchema, ShellyNgSupportedDeviceSchema } from '../schemas/devices.schemas';
import type { IShellyNgDeviceInfo, IShellyNgDeviceInfoRequest, IShellyNgSupportedDevice } from '../schemas/devices.types';

export const transformSupportedDevicesResponse = (response: object[]): IShellyNgSupportedDevice[] => {
	const devices = [];

	for (const row of response) {
		const parsed = ShellyNgSupportedDeviceSchema.safeParse(snakeToCamel(row));

		if (!parsed.success) {
			console.error('Schema validation failed with:', parsed.error);

			throw new DevicesShellyNgValidationException('Failed to validate received supported device data.');
		}

		devices.push(parsed.data);
	}

	return devices;
};

export const transformDeviceInfoResponse = (response: object): IShellyNgDeviceInfo => {
	const parsed = ShellyNgDeviceInfoSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new DevicesShellyNgValidationException('Failed to validate received device info data.');
	}

	return parsed.data;
};

export const transformDeviceInfoRequest = (data: object): IShellyNgDeviceInfoRequest => {
	const parsed = ShellyNgDeviceInfoRequestSchema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new DevicesShellyNgValidationException('Failed to validate get device info request.');
	}

	return parsed.data;
};
