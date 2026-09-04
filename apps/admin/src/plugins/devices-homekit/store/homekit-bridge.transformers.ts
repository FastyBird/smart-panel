import type { ZodType } from 'zod';

import { logger, snakeToCamel } from '../../../common';
import type {
	DevicesHomeKitPluginBridgeStatusSchema,
	DevicesHomeKitPluginDeviceCandidateSchema,
} from '../../../openapi.constants';
import { DevicesHomeKitValidationException } from '../devices-homekit.exceptions';

import { HomeKitBridgeStatusSchema, HomeKitDeviceCandidateSchema } from './homekit-bridge.store.schemas';
import type { IHomeKitBridgeStatus, IHomeKitDeviceCandidate } from './homekit-bridge.store.types';

const parse = <T>(value: unknown, schema: ZodType<T>, label: string): T => {
	const result = schema.safeParse(snakeToCamel(value as Record<string, unknown>));

	if (!result.success) {
		logger.error(`HomeKit ${label} schema validation failed:`, result.error);
		throw new DevicesHomeKitValidationException(`Failed to validate HomeKit ${label}.`);
	}

	return result.data;
};

export const transformHomeKitBridgeStatus = (value: DevicesHomeKitPluginBridgeStatusSchema): IHomeKitBridgeStatus =>
	parse(value, HomeKitBridgeStatusSchema, 'bridge status');

export const transformHomeKitDeviceCandidate = (
	value: DevicesHomeKitPluginDeviceCandidateSchema
): IHomeKitDeviceCandidate => parse(value, HomeKitDeviceCandidateSchema, 'device candidate');

export const transformHomeKitCandidates = (
	values: DevicesHomeKitPluginDeviceCandidateSchema[]
): IHomeKitDeviceCandidate[] => values.map(transformHomeKitDeviceCandidate);
