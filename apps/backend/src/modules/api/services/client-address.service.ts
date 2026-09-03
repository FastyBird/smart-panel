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

// Log "forwarded headers ignored" at most once per peer per hour.
const UNTRUSTED_WARNING_INTERVAL_MS = 60 * 60 * 1000;
// Bounds the untrusted-peer warning map so a scan/flood from many distinct
// peers can't grow it without limit; the oldest entry is evicted once full.
const UNTRUSTED_WARNING_MAX_PEERS = 1000;

/**
 * Resolves the real client address for a request, honouring forwarded
 * identity headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`,
 * `X-Forwarded-Proto`) only when the immediate socket peer is in the
 * `TrustedProxyRegistryService` trust set. Untrusted peers get their own
 * socket address back, and any forwarded headers they sent are ignored (and
 * logged, rate-limited).
 *
 * Accepts three request shapes so the same resolution logic serves HTTP
 * (Fastify) and websocket (socket.io handshake) call sites:
 * `FastifyRequest`, a plain `IncomingMessage`, or a socket.io `Handshake`.
 */
@Injectable()
export class ClientAddressService {
	private readonly logger = createExtensionLogger(API_MODULE_NAME, 'ClientAddressService');

	// Bounded `peer -> last-warned-at` map. Map iteration order is insertion
	// order and re-`set`ting an existing key does not move it, so eviction
	// (only triggered for a genuinely new key once the map is full) always
	// drops the oldest peer rather than disturbing an active one.
	private readonly untrustedWarnings = new Map<string, number>();

	constructor(private readonly trustedProxyRegistry: TrustedProxyRegistryService) {}

	resolve(request: FastifyRequest | IncomingMessage | ClientHandshake): ResolvedClientAddress {
		const normalized = this.normalizeRequest(request);
		const peer = normalized.peerAddress;

		if (!this.trustedProxyRegistry.isTrusted(peer)) {
			if (this.hasForwardingHeaders(normalized.headers)) {
				this.warnUntrustedForwardedHeaders(peer);
			}

			return { address: peer, forwarded: false, secure: normalized.secure, peer };
		}

		const { address, forwarded } = this.resolveForwardedAddress(normalized.headers, peer);
		const secure = this.resolveSecure(normalized.headers, normalized.secure);

		return { address, forwarded, secure, peer };
	}

	private normalizeRequest(request: FastifyRequest | IncomingMessage | ClientHandshake): NormalizedRequest {
		if (this.isHandshake(request)) {
			return {
				headers: request.headers,
				peerAddress: normalizeIpAddress(request.address ?? ''),
				secure: request.secure,
			};
		}

		const raw: IncomingMessage = 'raw' in request ? request.raw : request;
		const socket = raw.socket;

		return {
			headers: request.headers,
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
			headers[HEADER_X_FORWARDED_PROTO] !== undefined
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

		if (this.untrustedWarnings.size >= UNTRUSTED_WARNING_MAX_PEERS && !this.untrustedWarnings.has(peer)) {
			// Drop the oldest entry. Iterate-and-break instead of
			// `.keys().next().value` because the latter's `IteratorResult`
			// return type widens to `any` under our strict ESLint rules.
			for (const oldestKey of this.untrustedWarnings.keys()) {
				this.untrustedWarnings.delete(oldestKey);
				break;
			}
		}

		this.untrustedWarnings.set(peer, now);
		this.logger.warn(`Forwarded headers ignored from untrusted peer: ${peer}`);
	}
}
