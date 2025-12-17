import type { DiscoveredAdminExtension, DiscoveredBackendExtension } from '@fastybird/smart-panel-extension-sdk';

import { discoverExtensions } from './extensions-discovery';

type Discovered = {
	backend: DiscoveredBackendExtension[];
	admin: (DiscoveredAdminExtension & { packageDir?: string })[];
};

const DEFAULT_TTL_MS = Number(process.env.FB_EXT_DISCOVERY_TTL) || 20000;

let cache: { value: Discovered; expiresAt: number } | null = null;

export async function getDiscoveredExtensions(opts?: { force?: boolean }): Promise<Discovered> {
	const now = Date.now();

	if (!opts?.force && cache && cache.expiresAt > now) {
		return cache.value;
	}

	const fresh = await discoverExtensions();

	cache = { value: fresh, expiresAt: now + DEFAULT_TTL_MS };

	return fresh;
}

export function clearDiscoveryCache(): void {
	cache = null;
}
