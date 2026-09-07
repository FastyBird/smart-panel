import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	RemoteAccessAdvisory,
	RemoteAccessEndpoint,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

import { TailscaleCliError, TailscaleCliService, TailscaleServeStatus, TailscaleStatus } from './tailscale-cli.service';

export interface TailscaleServeResult {
	/** `https://<dnsname>` when the managed handler is active (private, or public once Funnel reads back active too); empty otherwise. */
	endpoints: RemoteAccessEndpoint[];
	/** `['127.0.0.1', '::1']` while the managed handler is active; empty otherwise. */
	proxyAddresses: string[];
	/** `tailnet-https-disabled`, `funnel-not-allowed`, `public-exposure` — see the class doc. */
	advisories: RemoteAccessAdvisory[];
	/**
	 * True only when `converge()`'s own mutating call (this specific
	 * invocation) failed with a `permission-denied` CLI error — always
	 * `false` from `read()`, which never mutates. `TailscaleNodeManagedService`
	 * uses this to refresh the `operator-granted` requirement and to log the
	 * denial, both only once per state transition rather than on every call
	 * while the grant stays revoked.
	 */
	permissionDenied: boolean;
}

/**
 * The three states the one handler this plugin manages (HTTPS, port 443,
 * path `/`, proxying to the backend) can be in. Serve and Funnel are not
 * independent toggles — confirmed against `cmd/tailscale/cli/serve_v2.go`:
 * `setServe()` always calls `applyFunnel(sc, dnsName, port, allowFunnel)`
 * where `allowFunnel` is exactly `subcmd == funnel`, so `tailscale serve
 * <target>` and `tailscale funnel <target>` build the identical Web/TCP
 * handler and differ only in whether `AllowFunnel[<dnsname>:443]` ends up
 * `true`. There is no "funnel off" command — going from `public` back to
 * `private` re-runs the plain `serve` form on the same handler.
 */
type HandlerState = 'off' | 'private' | 'public';

/**
 * Reads and converges the Tailscale Serve/Funnel handler (HTTPS on the
 * tailnet, optionally public through Funnel) for the `node` managed
 * service. `Self.CapMap` (the ACL capabilities granted by the control
 * plane) and `Self.DNSName` (needed to scope the read-back to this
 * plugin's own handler) are only meaningful once the node is `connected`,
 * so both `read()` and `converge()` are only called then.
 *
 * `read()` never mutates — it only issues the same `serve status --json`
 * read-back `converge()` also uses to confirm its own change, so it is
 * safe to call from any read path (`computeStatus()`, hence every GET
 * status endpoint) with no side effects. `converge()` compares that same
 * read against what `config` wants and, if they differ, issues *at most
 * one* mutating command, then re-reads to confirm — it is only ever called
 * from the poller (once per tick, gated on the node being healthy) and from
 * `onConfigChanged()` (immediately, for a responsive config change).
 *
 * Both derive their result from a fresh `serve status --json` read, so the
 * returned endpoints/proxyAddresses/advisories always reflect what
 * Tailscale actually reports for *this handler specifically* — never the
 * wish, and never any other handler a human or another process manages on
 * this node. Disabling never calls `serve reset` (which would clear those
 * unrelated handlers too); it removes only this one handler with the scoped
 * `serve ... off` form. A failed read or mutating call is caught and
 * logged; neither method ever throws, so a CLI hiccup degrades this one
 * call's contribution instead of failing the whole status computation.
 */
@Injectable()
export class TailscaleServeService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleServeService');

	constructor(private readonly cli: TailscaleCliService) {}

	/**
	 * Read-only status of this plugin's one managed handler. Never issues a
	 * `serve`/`funnel` mutation — only the same read-back call `converge()`
	 * uses to confirm its own change.
	 */
	async read(
		config: RemoteAccessTailscalePluginConfigModel,
		port: number,
		status: TailscaleStatus,
	): Promise<TailscaleServeResult> {
		const { hasHttpsCap, hasFunnelCap, dnsName } = this.readCaps(status);

		// Without a DNS name there is no `<dnsname>:443` key to scope the
		// read-back to, so nothing this plugin can safely report — skip
		// reading entirely rather than issue a call it cannot scope. In
		// practice a connected, online node always has one.
		const { serveActive, funnelActive } = dnsName
			? await this.readHandlerState(`${dnsName}:443`, `http://127.0.0.1:${port}`)
			: { serveActive: false, funnelActive: false };

		return this.buildResult(config, hasHttpsCap, hasFunnelCap, dnsName, serveActive, funnelActive, false);
	}

	/**
	 * Reads the current state of this plugin's one managed handler, and — if
	 * it differs from what `config` wants — issues exactly one command to
	 * converge it, then re-reads to confirm. Never more than one mutating
	 * call per invocation. Any failure (read or write) is caught and logged;
	 * the returned state always reflects the last successful read, never the
	 * attempted change. A `permission-denied` failure specifically is never
	 * logged here — it is reported back via `result.permissionDenied` so
	 * `TailscaleNodeManagedService` can log it (and refresh the
	 * `operator-granted` requirement) only once per state transition.
	 */
	async converge(
		config: RemoteAccessTailscalePluginConfigModel,
		port: number,
		status: TailscaleStatus,
	): Promise<TailscaleServeResult> {
		const { hasHttpsCap, hasFunnelCap, dnsName } = this.readCaps(status);
		const desired = this.desiredState(config, hasHttpsCap, hasFunnelCap);

		// Without a DNS name there is no `<dnsname>:443` key to scope the
		// read-back to, so nothing this plugin can safely verify — skip
		// converging entirely rather than issue a command it cannot confirm.
		// In practice a connected, online node always has one.
		const { serveActive, funnelActive, permissionDenied } = dnsName
			? await this.convergeHandler(desired, port, `${dnsName}:443`, `http://127.0.0.1:${port}`)
			: { serveActive: false, funnelActive: false, permissionDenied: false };

		return this.buildResult(config, hasHttpsCap, hasFunnelCap, dnsName, serveActive, funnelActive, permissionDenied);
	}

	private readCaps(status: TailscaleStatus): {
		hasHttpsCap: boolean;
		hasFunnelCap: boolean;
		dnsName: string | undefined;
	} {
		const capMap = status.Self?.CapMap ?? {};

		return {
			hasHttpsCap: Object.hasOwn(capMap, 'https'),
			hasFunnelCap: Object.hasOwn(capMap, 'funnel'),
			dnsName: this.stripTrailingDot(status.Self?.DNSName),
		};
	}

	private buildResult(
		config: RemoteAccessTailscalePluginConfigModel,
		hasHttpsCap: boolean,
		hasFunnelCap: boolean,
		dnsName: string | undefined,
		serveActive: boolean,
		funnelActive: boolean,
		permissionDenied: boolean,
	): TailscaleServeResult {
		const endpoints: RemoteAccessEndpoint[] = [];
		const proxyAddresses: string[] = [];

		if (serveActive && dnsName) {
			endpoints.push({
				url: `https://${dnsName}`,
				scope: funnelActive ? 'public' : 'private',
				https: true,
				label: funnelActive ? 'Tailscale (Funnel)' : 'Tailscale (HTTPS)',
			});
			proxyAddresses.push('127.0.0.1', '::1');
		}

		const advisories: RemoteAccessAdvisory[] = [];

		if (config.serveHttps && !hasHttpsCap) {
			advisories.push({
				code: 'tailnet-https-disabled',
				severity: 'warning',
				message:
					'HTTPS Serve was requested, but this tailnet does not have HTTPS certificates enabled. Enable them at https://login.tailscale.com/admin/dns.',
			});
		}

		if (config.funnel && !hasFunnelCap) {
			advisories.push({
				code: 'funnel-not-allowed',
				severity: 'warning',
				message:
					'Funnel was requested, but this node is not allowed to use it. Grant the `funnel` attribute for this node in the tailnet ACL policy.',
			});
		}

		if (funnelActive) {
			advisories.push({
				code: 'public-exposure',
				severity: 'warning',
				message:
					'This node is publicly reachable through Tailscale Funnel. The Smart Panel login is the only gate — multi-factor authentication is not available.',
			});
		}

		return { endpoints, proxyAddresses, advisories, permissionDenied };
	}

	private desiredState(
		config: RemoteAccessTailscalePluginConfigModel,
		hasHttpsCap: boolean,
		hasFunnelCap: boolean,
	): HandlerState {
		if (!config.serveHttps || !hasHttpsCap) {
			return 'off';
		}

		return config.funnel && hasFunnelCap ? 'public' : 'private';
	}

	private currentState(serveActive: boolean, funnelActive: boolean): HandlerState {
		if (!serveActive) {
			return 'off';
		}

		return funnelActive ? 'public' : 'private';
	}

	/** Read-only state of this plugin's own handler — the shared read-back `read()` and `converge()` both derive their result from. */
	private async readHandlerState(
		hostPort: string,
		targetUrl: string,
	): Promise<{ serveActive: boolean; funnelActive: boolean }> {
		const serveStatus = await this.readServeStatus();

		return {
			serveActive: this.isServeActive(serveStatus, hostPort, targetUrl),
			funnelActive: this.isFunnelActive(serveStatus, hostPort),
		};
	}

	/**
	 * Reads the current state of this plugin's one managed handler, and — if
	 * it differs from `desired` — issues exactly one command to converge it,
	 * then re-reads to confirm. Never more than one mutating call per
	 * invocation. Any failure (read or write) is caught and logged; the
	 * returned state always reflects the last successful read, never the
	 * attempted change. A `permission-denied` failure is reported back via
	 * `permissionDenied` instead of logged here — see `converge()`'s own doc.
	 */
	private async convergeHandler(
		desired: HandlerState,
		port: number,
		hostPort: string,
		targetUrl: string,
	): Promise<{ serveActive: boolean; funnelActive: boolean; permissionDenied: boolean }> {
		let serveStatus = await this.readServeStatus();
		let current = this.currentState(
			this.isServeActive(serveStatus, hostPort, targetUrl),
			this.isFunnelActive(serveStatus, hostPort),
		);
		let permissionDenied = false;

		if (current !== desired) {
			try {
				if (desired === 'off') {
					await this.cli.serveOff();
				} else if (desired === 'public') {
					await this.cli.funnelOn(port);
				} else {
					await this.cli.serve(port);
				}

				serveStatus = await this.readServeStatus();
				current = this.currentState(
					this.isServeActive(serveStatus, hostPort, targetUrl),
					this.isFunnelActive(serveStatus, hostPort),
				);
			} catch (error) {
				permissionDenied = error instanceof TailscaleCliError && error.kind === 'permission-denied';

				if (!permissionDenied) {
					this.logger.warn(`Failed to apply the Tailscale Serve/Funnel handler (wanted "${desired}")`, {
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		return {
			serveActive: current !== 'off',
			funnelActive: current === 'public',
			permissionDenied,
		};
	}

	private async readServeStatus(): Promise<TailscaleServeStatus | null> {
		try {
			return await this.cli.serveStatus();
		} catch (error) {
			this.logger.warn('Failed to read the Tailscale Serve status', {
				message: error instanceof Error ? error.message : String(error),
			});

			return null;
		}
	}

	/**
	 * True only for *this plugin's own* handler: `Web[hostPort]`'s `/`
	 * handler proxies to exactly `targetUrl`, and the matching `TCP["443"]`
	 * entry has HTTPS on. A handler on an unrelated host or port — set up by
	 * a human, another process, or a stale entry left by a previous
	 * `<backendPort>` — is never mistaken for this one, and neither `read()`
	 * nor `converge()` ever touches it.
	 */
	private isServeActive(status: TailscaleServeStatus | null, hostPort: string, targetUrl: string): boolean {
		if (!status) {
			return false;
		}

		const proxy = status.Web?.[hostPort]?.Handlers?.['/']?.Proxy;
		const https443 = status.TCP?.['443']?.HTTPS === true;

		return proxy === targetUrl && https443;
	}

	/** True only when Funnel is specifically allowed for this plugin's own `hostPort` entry — an unrelated host:port's `AllowFunnel` value is never read. */
	private isFunnelActive(status: TailscaleServeStatus | null, hostPort: string): boolean {
		if (!status) {
			return false;
		}

		return status.AllowFunnel?.[hostPort] === true;
	}

	private stripTrailingDot(name?: string): string | undefined {
		return name ? name.replace(/\.$/, '') : undefined;
	}
}
