import { FastifyRequest } from 'fastify';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import { Socket } from 'socket.io';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { API_MODULE_NAME } from '../api.constants';
import { normalizeIpAddress } from '../utils/ip-match.utils';

import { TrustedProxyRegistryService } from './trusted-proxy-registry.service';

/** The handshake object exposed by a socket.io `Socket` at connection time. */
type ClientHandshake = Socket['handshake'];

export interface ResolvedClientAddress {
	/** Canonical IPv4 or IPv6 text of the resolved client. */
	address: string;
	/** `true` when `address` was taken from a forwarded header through a trusted peer. */
	forwarded: boolean;
	/** `X-Forwarded-Proto === 'https'` from a trusted peer, else the raw connection's protocol. */
	secure: boolean;
	/** Raw socket peer address, regardless of trust. */
	peer: string;
	/**
	 * `true` when `peer` is untrusted but sent forwarding headers that were
	 * ignored (in which case `address` is just `peer` again, not a real
	 * client identity). Callers that special-case a "genuinely direct"
	 * connection — e.g. bypassing permit-join for a loopback display — MUST
	 * refuse that bypass when this is `true`: an unrecognised reverse proxy
	 * bound to loopback (cloudflared, `tailscale serve`, a local nginx) would
	 * otherwise turn every remote client reaching it into "localhost".
	 */
	ignoredForwardedHeaders: boolean;
}

interface NormalizedRequest {
	headers: IncomingHttpHeaders;
	peerAddress: string;
	secure: boolean;
}

const HEADER_X_FORWARDED_FOR = 'x-forwarded-for';
const HEADER_X_REAL_IP = 'x-real-ip';
const HEADER_CF_CONNECTING_IP = 'cf-connecting-ip';
const HEADER_X_FORWARDED_PROTO = 'x-forwarded-proto';
// RFC 7239 `Forwarded`. Never parsed for address resolution (the four
// headers above cover every proxy this backend actually needs to trust),
// but its presence still means a proxy is in front of the connection, so an
// untrusted peer sending only this header must still lose the localhost
// bypass — see `hasForwardingHeaders`.
const HEADER_FORWARDED = 'forwarded';

// Log "forwarded headers ignored" at most once per peer per hour.
const UNTRUSTED_WARNING_INTERVAL_MS = 60 * 60 * 1000;
// Hard backstop on the untrusted-peer warning map so a scan/flood from many
// distinct peers can't grow it without limit once stale-entry pruning (see
// `warnUntrustedForwardedHeaders`) has nothing left to reclaim.
const UNTRUSTED_WARNING_MAX_PEERS = 1000;

/**
 * Resolves the real client address for a request, honouring forwarded
 * identity headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`,
 * `X-Forwarded-Proto`) only when the immediate socket peer is in the
 * `TrustedProxyRegistryService` trust set. Untrusted peers get their own
 * socket address back, and any forwarded headers they sent are ignored (and
 * logged, rate-limited) — see `ResolvedClientAddress.ignoredForwardedHeaders`.
 *
 * Accepts three request shapes so the same resolution logic serves HTTP
 * (Fastify) and websocket (socket.io handshake) call sites:
 * `FastifyRequest`, a plain `IncomingMessage`, or a socket.io `Handshake`.
 *
 * Deliberate asymmetry in how a trusted peer's headers are read: a
 * malformed `X-Forwarded-For` entry aborts straight to the peer address
 * without trying `X-Real-IP` or `CF-Connecting-IP` next (see
 * `resolveRightmostUntrusted`) — `X-Forwarded-For` is a trust-sensitive
 * ordered chain the right-most-untrusted walk depends on, so a corrupted
 * entry invalidates the whole chain. `X-Real-IP` and `CF-Connecting-IP` are
 * simple, independent single values; an invalid one falls through to the
 * next header in the fallback order exactly like a missing one would.
 */
@Injectable()
export class ClientAddressService {
	private readonly logger = createExtensionLogger(API_MODULE_NAME, 'ClientAddressService');

	// Bounded `peer -> last-warned-at` map, pruned of stale entries on every
	// insert (see `warnUntrustedForwardedHeaders`) so it holds only peers
	// warned within the last hour, with `UNTRUSTED_WARNING_MAX_PEERS` as a
	// hard backstop beyond that.
	private readonly untrustedWarnings = new Map<string, number>();

	constructor(private readonly trustedProxyRegistry: TrustedProxyRegistryService) {}

	resolve(request: FastifyRequest | IncomingMessage | ClientHandshake): ResolvedClientAddress {
		const normalized = this.normalizeRequest(request);
		const peer = normalized.peerAddress;

		if (!this.trustedProxyRegistry.isTrusted(peer)) {
			const ignoredForwardedHeaders = this.hasForwardingHeaders(normalized.headers);

			if (ignoredForwardedHeaders) {
				this.warnUntrustedForwardedHeaders(peer);
			}

			return { address: peer, forwarded: false, secure: normalized.secure, peer, ignoredForwardedHeaders };
		}

		const { address, forwarded } = this.resolveForwardedAddress(normalized.headers, peer);
		const secure = this.resolveSecure(normalized.headers, normalized.secure);

		return { address, forwarded, secure, peer, ignoredForwardedHeaders: false };
	}

	private normalizeRequest(request: FastifyRequest | IncomingMessage | ClientHandshake): NormalizedRequest {
		if (this.isHandshake(request)) {
			return {
				// Default to `{}` so an unexpected/partial request shape (a
				// hand-built test double, a future caller) can't throw a
				// `TypeError` out of `hasForwardingHeaders`'s header lookups.
				headers: request.headers ?? {},
				peerAddress: normalizeIpAddress(request.address ?? ''),
				secure: request.secure,
			};
		}

		const raw: IncomingMessage = 'raw' in request ? request.raw : request;
		const socket = raw.socket;

		return {
			headers: request.headers ?? {},
			peerAddress: normalizeIpAddress(socket?.remoteAddress ?? ''),
			secure: Boolean(socket && 'encrypted' in socket && (socket as unknown as { encrypted?: boolean }).encrypted),
		};
	}

	private isHandshake(request: FastifyRequest | IncomingMessage | ClientHandshake): request is ClientHandshake {
		return !('raw' in request) && 'address' in request;
	}

	private resolveForwardedAddress(headers: IncomingHttpHeaders, peer: string): { address: string; forwarded: boolean } {
		const forwardedFor = this.headerToEntries(headers[HEADER_X_FORWARDED_FOR]);

		if (forwardedFor.length > 0) {
			const resolved = this.resolveRightmostUntrusted(forwardedFor);

			return resolved !== null ? { address: resolved, forwarded: true } : { address: peer, forwarded: false };
		}

		const realIp = this.firstValidAddress(this.headerToEntries(headers[HEADER_X_REAL_IP]));

		if (realIp !== null) {
			return { address: realIp, forwarded: true };
		}

		const cfConnectingIp = this.firstValidAddress(this.headerToEntries(headers[HEADER_CF_CONNECTING_IP]));

		if (cfConnectingIp !== null) {
			return { address: cfConnectingIp, forwarded: true };
		}

		return { address: peer, forwarded: false };
	}

	/**
	 * Right-most-untrusted rule (matches Home Assistant's `trusted_proxies`
	 * behaviour): walk `X-Forwarded-For` from the entry closest to us,
	 * skipping addresses the registry already trusts (they are proxy hops,
	 * not the client), and return the first one that isn't trusted. If every
	 * entry turns out to be a trusted hop, the chain never named an
	 * untrusted client, so fall back to the left-most entry. A malformed
	 * entry aborts the walk (`null`) — the caller falls back to the peer
	 * address rather than trusting anything past a corrupted hop.
	 */
	private resolveRightmostUntrusted(entries: string[]): string | null {
		for (let index = entries.length - 1; index >= 0; index--) {
			const candidate = entries[index].trim();

			if (isIP(candidate) === 0) {
				return null;
			}

			if (!this.trustedProxyRegistry.isTrusted(candidate)) {
				return normalizeIpAddress(candidate);
			}
		}

		return normalizeIpAddress(entries[0].trim());
	}

	private resolveSecure(headers: IncomingHttpHeaders, baseSecure: boolean): boolean {
		const proto = this.headerToEntries(headers[HEADER_X_FORWARDED_PROTO])[0];

		return proto !== undefined && proto.trim().toLowerCase() === 'https' ? true : baseSecure;
	}

	private hasForwardingHeaders(headers: IncomingHttpHeaders): boolean {
		return (
			headers[HEADER_X_FORWARDED_FOR] !== undefined ||
			headers[HEADER_X_REAL_IP] !== undefined ||
			headers[HEADER_CF_CONNECTING_IP] !== undefined ||
			headers[HEADER_X_FORWARDED_PROTO] !== undefined ||
			headers[HEADER_FORWARDED] !== undefined
		);
	}

	private headerToEntries(value: string | string[] | undefined): string[] {
		if (value === undefined) {
			return [];
		}

		const joined = (Array.isArray(value) ? value.join(',') : value).trim();

		return joined === '' ? [] : joined.split(',');
	}

	private firstValidAddress(entries: string[]): string | null {
		for (const entry of entries) {
			const candidate = entry.trim();

			if (isIP(candidate) !== 0) {
				return normalizeIpAddress(candidate);
			}
		}

		return null;
	}

	private warnUntrustedForwardedHeaders(peer: string): void {
		const now = Date.now();
		const last = this.untrustedWarnings.get(peer);

		if (last !== undefined && now - last < UNTRUSTED_WARNING_INTERVAL_MS) {
			return;
		}

		// Reclaim entries that fell out of their one-hour window before
		// falling back to the hard cap below. `Map.set` on an *existing* key
		// never moves it, so a peer that keeps getting re-warned stays at
		// its original (early) position in iteration order instead of
		// moving to the back like a real LRU — evicting "the first key in
		// iteration order" on the cap alone would then tend to evict the
		// longest-running, still-active warner rather than a stale one, and
		// a flood of distinct new peers could keep silently evicting active
		// entries and defeating their once-per-hour limit.
		for (const [key, warnedAt] of this.untrustedWarnings) {
			if (now - warnedAt >= UNTRUSTED_WARNING_INTERVAL_MS) {
				this.untrustedWarnings.delete(key);
			}
		}

		if (this.untrustedWarnings.size >= UNTRUSTED_WARNING_MAX_PEERS && !this.untrustedWarnings.has(peer)) {
			// Hard bound of last resort: the prune above already reclaimed
			// everything outside its one-hour window, so every remaining
			// entry is currently active and there is no better signal than
			// insertion order left to pick a victim. Iterate-and-break
			// instead of `.keys().next().value` because the latter's
			// `IteratorResult` return type widens to `any` under our strict
			// ESLint rules.
			for (const oldestKey of this.untrustedWarnings.keys()) {
				this.untrustedWarnings.delete(oldestKey);
				break;
			}
		}

		this.untrustedWarnings.set(peer, now);
		this.logger.warn(`Forwarded headers ignored from untrusted peer: ${peer}`);
	}
}
