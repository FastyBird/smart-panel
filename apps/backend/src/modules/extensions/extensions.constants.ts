export const EXTENSIONS_MODULE_PREFIX = 'extensions';

export const EXTENSIONS_MODULE_NAME = 'extensions-module';

export const EXTENSIONS_MODULE_API_TAG_NAME = 'Extensions module';

export const EXTENSIONS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing application extensions (modules and plugins). Provides information about installed extensions and allows enabling/disabling them.';

export enum ExtensionKind {
	MODULE = 'module',
	PLUGIN = 'plugin',
}

export enum ExtensionSurface {
	ADMIN = 'admin',
	BACKEND = 'backend',
}

export enum ExtensionSource {
	BUNDLED = 'bundled',
	RUNTIME = 'runtime',
}
