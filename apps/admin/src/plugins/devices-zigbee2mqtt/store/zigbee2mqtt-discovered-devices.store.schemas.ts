import { z } from 'zod';

// ============================================================================
// Z2M Expose Schema
// ============================================================================

export const Z2mExposeSchema: z.ZodType<{
	type: string;
	property?: string;
	name?: string;
	access?: number;
	unit?: string;
	valueMin?: number;
	valueMax?: number;
	valueStep?: number;
	values?: string[];
	features?: z.infer<typeof Z2mExposeSchema>[];
}> = z.object({
	type: z.string(),
	property: z.string().optional(),
	name: z.string().optional(),
	access: z.number().optional(),
	unit: z.string().optional(),
	valueMin: z.number().optional(),
	valueMax: z.number().optional(),
	valueStep: z.number().optional(),
	values: z.array(z.string()).optional(),
	features: z.lazy(() => z.array(Z2mExposeSchema).optional()),
});

// ============================================================================
// Discovered Device Schema
// ============================================================================

export const Zigbee2mqttDiscoveredDeviceSchema = z.object({
	id: z.string(),
	friendlyName: z.string(),
	type: z.enum(['Router', 'EndDevice']),
	modelId: z.string().nullable(),
	manufacturer: z.string().nullable(),
	model: z.string().nullable(),
	description: z.string().nullable(),
	powerSource: z.string().nullable(),
	supported: z.boolean(),
	available: z.boolean(),
	adopted: z.boolean(),
	adoptedDeviceId: z.string().nullable(),
	exposes: z.array(Z2mExposeSchema),
	suggestedCategory: z.string().nullable(),
});

export type Zigbee2mqttDiscoveredDeviceSchemaType = z.infer<typeof Zigbee2mqttDiscoveredDeviceSchema>;
