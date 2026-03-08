import { type ZodType, z } from 'zod';

import type {
	DevicesModuleDeviceValidationResultSchema as ApiDeviceValidationResult,
	DevicesModuleDevicesValidationSchema as ApiDevicesValidation,
	DevicesModuleValidationIssueSchema as ApiValidationIssue,
	DevicesModuleValidationSummarySchema as ApiValidationSummary,
} from '../../../openapi.constants';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleDataValidationIssueSeverity,
	DevicesModuleDataValidationIssueType,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';

import { ItemIdSchema } from './types';

// STORE STATE
// ===========

export const ValidationIssueSchema = z.object({
	type: z.nativeEnum(DevicesModuleDataValidationIssueType),
	severity: z.nativeEnum(DevicesModuleDataValidationIssueSeverity),
	channelCategory: z.nativeEnum(DevicesModuleChannelCategory).optional(),
	channelId: ItemIdSchema.nullable().optional(),
	propertyCategory: z.nativeEnum(DevicesModuleChannelPropertyCategory).optional(),
	propertyId: ItemIdSchema.nullable().optional(),
	message: z.string().trim().nonempty(),
	expected: z.string().nullable().optional(),
	actual: z.string().nullable().optional(),
});

export const DeviceValidationResultSchema = z.object({
	deviceId: ItemIdSchema,
	deviceIdentifier: z.string().nullable().optional(),
	deviceName: z.string().trim().nonempty(),
	deviceCategory: z.nativeEnum(DevicesModuleDeviceCategory),
	pluginType: z.string().trim().nonempty(),
	isValid: z.boolean(),
	issues: z.array(ValidationIssueSchema),
});

export const ValidationSummarySchema = z.object({
	totalDevices: z.number().int().nonnegative(),
	validDevices: z.number().int().nonnegative(),
	invalidDevices: z.number().int().nonnegative(),
	totalIssues: z.number().int().nonnegative(),
	errorCount: z.number().int().nonnegative(),
	warningCount: z.number().int().nonnegative(),
});

export const DevicesValidationSchema = z.object({
	summary: ValidationSummarySchema,
	devices: z.array(DeviceValidationResultSchema),
});

export const DevicesValidationStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
});

// BACKEND API RESPONSE SCHEMAS (snake_case)
// =========================================

export const ValidationIssueResSchema: ZodType<ApiValidationIssue> = z.object({
	type: z.nativeEnum(DevicesModuleDataValidationIssueType),
	severity: z.nativeEnum(DevicesModuleDataValidationIssueSeverity),
	channel_category: z.nativeEnum(DevicesModuleChannelCategory).optional(),
	channel_id: z.string().uuid().nullable().optional(),
	property_category: z.nativeEnum(DevicesModuleChannelPropertyCategory).optional(),
	property_id: z.string().uuid().nullable().optional(),
	message: z.string(),
	expected: z.string().nullable().optional(),
	actual: z.string().nullable().optional(),
});

export const DeviceValidationResultResSchema: ZodType<ApiDeviceValidationResult> = z.object({
	device_id: z.string().uuid(),
	device_identifier: z.string().nullable().optional(),
	device_name: z.string(),
	device_category: z.nativeEnum(DevicesModuleDeviceCategory),
	plugin_type: z.string(),
	is_valid: z.boolean(),
	issues: z.array(ValidationIssueResSchema),
});

export const ValidationSummaryResSchema: ZodType<ApiValidationSummary> = z.object({
	total_devices: z.number(),
	valid_devices: z.number(),
	invalid_devices: z.number(),
	total_issues: z.number(),
	error_count: z.number(),
	warning_count: z.number(),
});

export const DevicesValidationResSchema: ZodType<ApiDevicesValidation> = z.object({
	summary: ValidationSummaryResSchema,
	devices: z.array(DeviceValidationResultResSchema),
});
