import type { z } from 'zod';

import type { DevicesUnifiProtectPluginTlsMode } from '../../../openapi.constants';

import type {
	ProtectCertificateSchema,
	ProtectDiscoveredConsoleSchema,
	ProtectDiscoverySchema,
	ProtectProbeSchema,
	ProtectStatusSchema,
	ProtectTestConnectionSchema,
} from './protect.schemas';

export type IProtectStatus = z.infer<typeof ProtectStatusSchema>;
export type IProtectCertificate = z.infer<typeof ProtectCertificateSchema>;
export type IProtectTestConnection = z.infer<typeof ProtectTestConnectionSchema>;
export type IProtectProbe = z.infer<typeof ProtectProbeSchema>;
export type IProtectDiscoveredConsole = z.infer<typeof ProtectDiscoveredConsoleSchema>;
export type IProtectDiscovery = z.infer<typeof ProtectDiscoverySchema>;

/** The host, port and certificate trust a connection test was run for. It never carries the API key. */
export interface IProtectTestTarget {
	host: string;
	port: number;
	tlsMode: DevicesUnifiProtectPluginTlsMode;
}

export interface IProtectTestResult {
	result: IProtectTestConnection;
	target: IProtectTestTarget | null;
	/** Epoch milliseconds when the result arrived. */
	at: number;
}

/** A connection test that the client gave up on. The backend may still have finished it. */
export interface IProtectTestTimeout {
	timedOut: true;
}

export interface IProtectProbeInput {
	host: string;
	port?: number;
}
