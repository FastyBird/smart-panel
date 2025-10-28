export type ExtensionKind = 'module' | 'plugin';

export interface ClassType<T = unknown> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	new (...args: any[]): T;
}

/**
 * Backend manifest placed in package.json under: fastybird.smartPanelBackend
 * Used by the server to mount Nest modules and routes.
 */
export interface SmartPanelBackendExtensionManifest {
	/** 'module' mounts under /api/<prefix>, 'plugin' under /api/plugins/<prefix>. */
	kind: ExtensionKind;

	/**
	 * HTTP route segment(s) used for RouterModule mounting.
	 *  - plugin: "devices/acme"  → /api/plugins/devices/acme
	 *  - module: "telemetry"     → /api/telemetry
	 */
	routePrefix: string;

	/**
	 * Named export from the backend entry that is a Nest module class.
	 * Example: "AcmeDevicesModule"
	 */
	extensionExport: string;

	/** Optional semver range indicating the backend SDK compatibility. */
	sdkVersion?: string;

	/** Optional human-friendly name (for logs / UIs). */
	displayName?: string;

	/** Optional short description. */
	description?: string;
}

export interface DiscoveredBackendExtension {
	/** npm package name, e.g., "@fastybird/smart-panel-extension-devices-acme" */
	pkgName: string;

	/** Normalized route prefix (no leading/trailing slashes). */
	routePrefix: string;

	/** The resolved Nest module class (class-like). */
	extensionClass: ClassType<unknown>;

	/** 'module' | 'plugin' */
	kind: ExtensionKind;

	/** Absolute path to the package root on disk (where package.json lives). */
	packageDir: string;

	/** Optional metadata */
	displayName?: string;
	description?: string;
}

/**
 * Admin manifest placed in package.json under: fastybird.smartPanelAdmin
 * Used to generate static imports for the Admin build, and/or to locate
 * a remote ESM entry for runtime loading (no rebuild).
 */
export interface SmartPanelAdminExtensionManifest {
	/** 'module' adds core UI, 'plugin' adds optional UI parts. */
	kind: ExtensionKind;

	/**
	 * Module specifier for static import in Admin (usually the package name).
	 * If omitted, the generator will use package.json.name.
	 */
	importPath?: string;

	/**
	 * Named export from the Admin entry if the plugin does NOT export default.
	 * Most Vue plugins export default, so this is optional.
	 */
	extensionExport?: string;

	/** Optional semver range indicating the Admin SDK compatibility. */
	sdkVersion?: string;

	/**
	 * Optional ESM entry file for runtime/remote mode (no rebuild), e.g. "admin/index.js".
	 * The backend can expose it under a public URL: /extensions/<pkg>/admin/index.js
	 */
	extensionEntry?: string;

	/** Optional human-friendly name (for logs / UIs). */
	displayName?: string;

	/** Optional short description. */
	description?: string;
}

export interface DiscoveredAdminExtension {
	/** npm package name, e.g., "@fastybird/smart-panel-extension-devices-acme" */
	pkgName: string;

	/** Module specifier to import from in Admin (usually the package name). */
	importPath: string;

	/** Named export if not using default export (optional). */
	extensionExport?: string;

	/** Runtime/remote ESM entry (optional). */
	extensionEntry?: string;

	/** 'module' | 'plugin' */
	kind: ExtensionKind;

	/** Absolute path to the package root on disk (where package.json lives). */
	packageDir: string;

	/** Optional metadata */
	displayName?: string;
	description?: string;
}
