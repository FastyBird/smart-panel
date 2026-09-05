import type { ZodType } from 'zod';

import { logger, snakeToCamel } from '../../../common';
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

/**
 * Validates and transforms raw backend bridge status data into typed `IHomeKitBridgeStatus`.
 *
 * Converts snake_case properties to camelCase and validates against `HomeKitBridgeStatusSchema`.
 *
 * @param value - Raw bridge status payload from the backend API or WebSocket event.
 * @returns The validated and typed `IHomeKitBridgeStatus` object.
 * @throws {DevicesHomeKitValidationException} If payload fails schema validation.
 */
export const transformHomeKitBridgeStatus = (value: unknown): IHomeKitBridgeStatus => parse(value, HomeKitBridgeStatusSchema, 'bridge status');

/**
 * Validates and transforms raw backend device candidate data into typed `IHomeKitDeviceCandidate`.
 *
 * Converts snake_case properties to camelCase and validates against `HomeKitDeviceCandidateSchema`.
 *
 * @param value - Raw candidate device payload from the backend API.
 * @returns The validated and typed `IHomeKitDeviceCandidate` object.
 * @throws {DevicesHomeKitValidationException} If payload fails schema validation.
 */
export const transformHomeKitDeviceCandidate = (value: unknown): IHomeKitDeviceCandidate =>
	parse(value, HomeKitDeviceCandidateSchema, 'device candidate');

/**
 * Validates and transforms an array of raw device candidate payloads into `IHomeKitDeviceCandidate[]`.
 *
 * @param values - Array of raw device candidate payloads from the backend API.
 * @returns An array of validated `IHomeKitDeviceCandidate` objects.
 */
export const transformHomeKitCandidates = (values: unknown[]): IHomeKitDeviceCandidate[] => values.map(transformHomeKitDeviceCandidate);
