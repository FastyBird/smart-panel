/**
 * Runtime state of a registered remote-access provider, as reported by its
 * own `getStatus()` implementation.
 */
export type RemoteAccessProviderState =
	| 'unsupported' // platform cannot host this provider (docker, home-assistant)
	| 'not-installed' // binary missing
	| 'setup-required' // daemon stopped, operator missing, re-authentication needed
	| 'pending-auth' // waiting for the admin to approve a login link
	| 'pending-approval' // device approval pending in the vendor console
	| 'connecting'
	| 'connected'
	| 'disconnected' // installed and configured but intentionally down
	| 'error';

/**
 * Whether an endpoint is reachable from the mesh/tunnel only, or from the
 * public internet.
 */
export type RemoteAccessEndpointScope = 'private' | 'public';

/**
 * One way to reach this installation, published by a provider (or the
 * module's own manual `external_url`).
 */
export interface RemoteAccessEndpoint {
	/** Absolute origin, no path. */
	url: string;
	scope: RemoteAccessEndpointScope;
	https: boolean;
	/** Human-readable label, e.g. "Tailscale (HTTPS)", "Manual external URL". */
	label: string;
}

/** Severity of a posture or provider advisory. */
export type RemoteAccessAdvisorySeverity = 'info' | 'warning' | 'critical';

/**
 * A user-facing note about the current remote-access posture, either
 * module-level (see `RemoteAccessPostureService`) or provider-sourced
 * (passed through from `RemoteAccessProviderStatus.advisories`).
 */
export interface RemoteAccessAdvisory {
	/** Stable machine-readable code, e.g. `external-url-insecure`, `public-exposure`. */
	code: string;
	severity: RemoteAccessAdvisorySeverity;
	/** Human-readable explanation. */
	message: string;
	/** Provider type this advisory came from; absent for module-level advisories. */
	provider?: string;
}

/**
 * Full status payload a provider reports, on demand (`getStatus()`) or
 * pushed through the `RemoteAccessModule.Provider.Status` event. Never
 * carries an auth URL, QR code or key material — those are returned only by
 * a provider plugin's own owner/admin-gated REST endpoint.
 */
export interface RemoteAccessProviderStatus {
	type: string;
	state: RemoteAccessProviderState;
	endpoints: RemoteAccessEndpoint[];
	/** Human-readable detail for `setup-required` / `error` states. */
	message?: string;
	/** Provider-specific fields, safe to display verbatim. */
	details: Record<string, string | number | boolean | null>;
	/**
	 * Loopback or single-host addresses this provider proxies from while
	 * active — never a CIDR range; a provider proxies from one fixed local
	 * address, and broad ranges belong only to the operator's own
	 * `trusted_proxies` config. `RemoteAccessProxyContributionService`
	 * validates every entry (`isValidTrustedProxyEntry` plus a same-service
	 * check that rejects a `/` suffix) before it reaches
	 * `TrustedProxyRegistryService`; a malformed entry or a CIDR range is
	 * dropped and logged once rather than trusted.
	 */
	proxyAddresses: string[];
	advisories: RemoteAccessAdvisory[];
	/** ISO 8601 timestamp of when this status was produced. */
	updatedAt: string;
}

/** Static capability flags a provider declares about itself. */
export interface RemoteAccessProviderCapabilities {
	https: boolean;
	publicUrl: boolean;
	identityHeaders: boolean;
	ssh: boolean;
}

export type RemoteAccessProviderKind = 'mesh' | 'tunnel' | 'vpn' | 'external';

/**
 * Contract every remote-access provider plugin implements and registers
 * with `RemoteAccessProviderRegistryService.register()` in its own
 * `onModuleInit`. The module never shells out and never knows a provider's
 * binary; providers never resolve URLs for other modules and never touch
 * request handling.
 */
export interface IRemoteAccessProvider {
	/** Plugin type identifier, e.g. `remote-access-tailscale`. */
	readonly type: string;
	readonly kind: RemoteAccessProviderKind;
	readonly capabilities: RemoteAccessProviderCapabilities;
	getStatus(): Promise<RemoteAccessProviderStatus>;
}
