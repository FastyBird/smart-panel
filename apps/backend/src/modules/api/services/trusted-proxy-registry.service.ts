import { Injectable } from '@nestjs/common';

import { isIpInCidr } from '../utils/ip-match.utils';

/**
 * One contributor to the trusted-proxy set. `addresses()` is read live on
 * every `isTrusted()` call rather than snapshotted at `register()` time, so
 * a contributor whose proxy set changes (a provider reconnecting with a new
 * address) is picked up without re-registering.
 */
export interface TrustedProxySource {
	/** Stable id for this contributor; re-registering the same id replaces it. */
	id: string;
	/** Current set of trusted peer addresses or CIDR ranges (IPv4 or IPv6). */
	addresses: () => readonly string[];
}

/**
 * Registry of peer addresses allowed to hand this backend forwarded-identity
 * headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`,
 * `X-Forwarded-Proto`). `ApiModule` registers the `FB_TRUSTED_PROXIES` env
 * source at bootstrap; the `remote-access` module (RA-2) contributes
 * connected providers' proxy addresses through the same interface, so this
 * module never depends on `remote-access`.
 */
@Injectable()
export class TrustedProxyRegistryService {
	private readonly sources = new Map<string, TrustedProxySource>();

	register(source: TrustedProxySource): void {
		this.sources.set(source.id, source);
	}

	unregister(id: string): void {
		this.sources.delete(id);
	}

	isTrusted(peer: string): boolean {
		if (!peer) {
			return false;
		}

		for (const source of this.sources.values()) {
			for (const entry of source.addresses()) {
				if (isIpInCidr(peer, entry)) {
					return true;
				}
			}
		}

		return false;
	}
}
