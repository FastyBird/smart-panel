import { z } from 'zod';

import {
	DevicesUnifiProtectPluginConnectionState,
	DevicesUnifiProtectPluginDiscoveryFailureReason,
	DevicesUnifiProtectPluginDiscoveryInterfaceErrorCode,
	DevicesUnifiProtectPluginDiscoveryInterfaceStatus,
	DevicesUnifiProtectPluginDiscoveryStatus,
	DevicesUnifiProtectPluginDiscoveryWarning,
	DevicesUnifiProtectPluginErrorCategory,
	DevicesUnifiProtectPluginProbeFailure,
	DevicesUnifiProtectPluginProbeProtect,
	DevicesUnifiProtectPluginProbeStatus,
	DevicesUnifiProtectPluginRealtimeState,
	DevicesUnifiProtectPluginTlsMode,
} from '../../../openapi.constants';

export const ProtectStatusSchema = z.object({
	serviceState: z.string(),
	connectionState: z.nativeEnum(DevicesUnifiProtectPluginConnectionState),
	enabled: z.boolean(),
	configured: z.boolean(),
	healthy: z.boolean(),
	tlsMode: z.nativeEnum(DevicesUnifiProtectPluginTlsMode),
	applicationVersion: z.string().nullable().optional(),
	minimumVersion: z.string(),
	nvrId: z.string().nullable().optional(),
	nvrName: z.string().nullable().optional(),
	lastConnectedAt: z.string().nullable().optional(),
	lastErrorCategory: z.nativeEnum(DevicesUnifiProtectPluginErrorCategory).nullable().optional(),
	lastError: z.string().nullable().optional(),
	reconnectAttempt: z.number().int().nonnegative(),
	nextRetryAt: z.string().nullable().optional(),
	realtimeState: z.nativeEnum(DevicesUnifiProtectPluginRealtimeState),
	ignoredEventCount: z.number().int().nonnegative(),
});

export const ProtectCertificateSchema = z.object({
	fingerprintSha256: z.string(),
	subjectCommonName: z.string().nullable().optional(),
	issuerCommonName: z.string().nullable().optional(),
	subjectAltNames: z.array(z.string()),
	validFrom: z.string(),
	validTo: z.string(),
	selfSigned: z.boolean(),
	trusted: z.boolean(),
});

export const ProtectTestConnectionSchema = z.object({
	mode: z.enum(['saved', 'candidate']),
	success: z.boolean(),
	tlsMode: z.nativeEnum(DevicesUnifiProtectPluginTlsMode).nullable().optional(),
	certificate: ProtectCertificateSchema.nullable().optional(),
	directConnectDomain: z.string().nullable().optional(),
	suggestedServerName: z.string().nullable().optional(),
	consoleName: z.string().nullable().optional(),
	consoleModel: z.string().nullable().optional(),
	applicationVersion: z.string().nullable().optional(),
	minimumVersion: z.string(),
	versionSupported: z.boolean().nullable().optional(),
	nvrName: z.string().nullable().optional(),
	errorCategory: z.nativeEnum(DevicesUnifiProtectPluginErrorCategory).nullable().optional(),
	error: z.string().nullable().optional(),
});

export const ProtectProbeCertificateSchema = z.object({
	checked: z.boolean(),
	domain: z.string(),
	valid: z.boolean().nullable().optional(),
	errorCode: z.string().nullable().optional(),
	validTo: z.string().nullable().optional(),
	domainResolvesToHost: z.boolean(),
});

export const ProtectProbeSchema = z.object({
	host: z.string(),
	port: z.number().int(),
	status: z.nativeEnum(DevicesUnifiProtectPluginProbeStatus),
	failure: z.nativeEnum(DevicesUnifiProtectPluginProbeFailure).nullable().optional(),
	protect: z.nativeEnum(DevicesUnifiProtectPluginProbeProtect),
	model: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
	mac: z.string().nullable().optional(),
	deviceState: z.string().nullable().optional(),
	directConnectDomain: z.string().nullable().optional(),
	certificate: ProtectProbeCertificateSchema.nullable().optional(),
	preferredHost: z.string().nullable().optional(),
});

export const ProtectDiscoveredConsoleSchema = z.object({
	mac: z.string(),
	host: z.string(),
	addresses: z.array(z.string()),
	hostname: z.string().nullable().optional(),
	model: z.string().nullable().optional(),
	firmware: z.string().nullable().optional(),
	directConnectDomain: z.string().nullable().optional(),
	uuid: z.string().nullable().optional(),
	probe: ProtectProbeSchema,
});

export const ProtectDiscoveryInterfaceSchema = z.object({
	name: z.string(),
	address: z.string(),
	broadcastAddress: z.string(),
	status: z.nativeEnum(DevicesUnifiProtectPluginDiscoveryInterfaceStatus),
	errorCode: z.nativeEnum(DevicesUnifiProtectPluginDiscoveryInterfaceErrorCode).nullable().optional(),
});

export const ProtectDiscoverySchema = z.object({
	status: z.nativeEnum(DevicesUnifiProtectPluginDiscoveryStatus),
	failureReason: z.nativeEnum(DevicesUnifiProtectPluginDiscoveryFailureReason).nullable().optional(),
	warnings: z.array(z.nativeEnum(DevicesUnifiProtectPluginDiscoveryWarning)),
	startedAt: z.string().nullable().optional(),
	finishedAt: z.string().nullable().optional(),
	interfaces: z.array(ProtectDiscoveryInterfaceSchema),
	consoles: z.array(ProtectDiscoveredConsoleSchema),
	otherUnifiDevices: z.number().int().nonnegative(),
});
