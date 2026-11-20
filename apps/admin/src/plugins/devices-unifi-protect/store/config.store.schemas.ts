import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	type DevicesUnifiProtectPluginConfigSchema,
	DevicesUnifiProtectPluginStreamQuality,
	DevicesUnifiProtectPluginTlsMode,
	type DevicesUnifiProtectPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME } from '../devices-unifi-protect.constants';

const TlsModeSchema = z.nativeEnum(DevicesUnifiProtectPluginTlsMode);
const StreamQualitySchema = z.nativeEnum(DevicesUnifiProtectPluginStreamQuality);

export const ProtectConfigSchema = ConfigPluginSchema.extend({
	host: z.string().nullable(),
	port: z.number().int().positive(),
	// The backend redacts the key on read and answers with apiKeyConfigured instead, so the stored
	// config has no key at all. It stays declared because the edit form writes a replacement into it.
	apiKey: z.string().trim().min(1).nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
	tls: z.object({
		mode: TlsModeSchema,
		serverName: z.string().nullable().default(null),
		fingerprintSha256: z.string().nullable().default(null),
	}),
	streamHostOverride: z.string().nullable().default(null),
	defaultStreamQuality: StreamQualitySchema,
	snapshotMinIntervalMs: z.number().int().positive(),
	pollIntervalMs: z.number().int().positive(),
});

export const ProtectConfigUpdateReqSchema: ZodType<DevicesUnifiProtectPluginUpdateConfigSchema> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_UNIFI_PROTECT_PLUGIN_NAME),
		host: z.string().nullable().optional(),
		port: z.number().int().optional(),
		api_key: z.string().trim().min(1).nullable().optional(),
		tls: z
			.object({
				mode: TlsModeSchema.optional(),
				server_name: z.string().nullable().optional(),
				fingerprint_sha256: z.string().nullable().optional(),
			})
			.optional(),
		stream_host_override: z.string().nullable().optional(),
		default_stream_quality: StreamQualitySchema.optional(),
		snapshot_min_interval_ms: z.number().int().optional(),
		poll_interval_ms: z.number().int().optional(),
	})
);

export const ProtectConfigResSchema: ZodType<DevicesUnifiProtectPluginConfigSchema> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_UNIFI_PROTECT_PLUGIN_NAME),
		host: z.string().nullable().optional(),
		port: z.number().int(),
		api_key: z.string().trim().min(1).nullable().optional(),
		api_key_configured: z.boolean(),
		tls: z.object({
			mode: TlsModeSchema,
			server_name: z.string().nullable().optional(),
			fingerprint_sha256: z.string().nullable().optional(),
		}),
		stream_host_override: z.string().nullable().optional(),
		default_stream_quality: StreamQualitySchema,
		snapshot_min_interval_ms: z.number().int(),
		poll_interval_ms: z.number().int(),
	})
);
