import type { SmartPanelAdminExtensionManifest, SmartPanelBackendExtensionManifest } from './types.js';

export function isSmartPanelBackendExtensionManifest(v: unknown): v is SmartPanelBackendExtensionManifest {
	if (!v || typeof v !== 'object') {
		return false;
	}

	const o = v as Record<string, unknown>;

	const kindOk = o.kind === 'module' || o.kind === 'plugin';
	const routeOk = typeof o.routePrefix === 'string' && o.routePrefix.trim().length > 0;
	const exportOk = typeof o.extensionExport === 'string' && o.extensionExport.trim().length > 0;

	return kindOk && routeOk && exportOk;
}

/** Type guard for admin manifest. */
export function isSmartPanelAdminExtensionManifest(v: unknown): v is SmartPanelAdminExtensionManifest {
	if (!v || typeof v !== 'object') {
		return false;
	}

	const o = v as Record<string, unknown>;

	const kindOk = o.kind === 'module' || o.kind === 'plugin';

	return kindOk;
}

/**
 * Normalize route prefix: strip leading/trailing slashes and collapse multiple slashes.
 */
export function normalizeRoutePrefix(route: string): string {
	return route.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}
