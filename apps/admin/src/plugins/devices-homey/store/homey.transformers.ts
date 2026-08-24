import type { ZodType } from 'zod';

import { logger, snakeToCamel } from '../../../common';
import type {
	DevicesHomeyPluginAdoptionResultSchema,
	DevicesHomeyPluginInventoryDeviceSchema,
	DevicesHomeyPluginMappingPreviewSchema,
	DevicesHomeyPluginStatusSchema,
	DevicesHomeyPluginTestConnectionSchema,
} from '../../../openapi.constants';
import { DevicesHomeyValidationException } from '../devices-homey.exceptions';

import {
	HomeyAdoptionResultSchema,
	HomeyInventoryDeviceSchema,
	HomeyMappingPreviewSchema,
	HomeyStatusSchema,
	HomeyTestConnectionSchema,
} from './homey.schemas';
import type { IHomeyAdoptionResult, IHomeyInventoryDevice, IHomeyMappingPreview, IHomeyStatus, IHomeyTestConnection } from './homey.types';

const parse = <T>(value: unknown, schema: ZodType<T>, label: string): T => {
	const result = schema.safeParse(snakeToCamel(value as Record<string, unknown>));

	if (!result.success) {
		logger.error(`Homey ${label} schema validation failed:`, result.error);
		throw new DevicesHomeyValidationException(`Failed to validate Homey ${label}.`);
	}

	return result.data;
};

export const transformHomeyStatus = (value: DevicesHomeyPluginStatusSchema): IHomeyStatus => parse(value, HomeyStatusSchema, 'status');

export const transformHomeyTestConnection = (value: DevicesHomeyPluginTestConnectionSchema): IHomeyTestConnection =>
	parse(value, HomeyTestConnectionSchema, 'connection test');

export const transformHomeyInventoryDevice = (value: DevicesHomeyPluginInventoryDeviceSchema): IHomeyInventoryDevice =>
	parse(value, HomeyInventoryDeviceSchema, 'inventory device');

export const transformHomeyMappingPreview = (value: DevicesHomeyPluginMappingPreviewSchema): IHomeyMappingPreview =>
	parse(value, HomeyMappingPreviewSchema, 'mapping preview');

export const transformHomeyAdoptionResult = (value: DevicesHomeyPluginAdoptionResultSchema): IHomeyAdoptionResult =>
	parse(value, HomeyAdoptionResultSchema, 'adoption result');
