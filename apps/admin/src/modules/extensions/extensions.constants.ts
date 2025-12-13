export const EXTENSIONS_MODULE_PREFIX = 'extensions-module';

export const EXTENSIONS_MODULE_NAME = 'extensions-module';

export const EXTENSIONS_MODULE_EVENT_PREFIX = 'ExtensionsModule.';

export enum ExtensionKind {
	MODULE = 'module',
	PLUGIN = 'plugin',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	EXTENSIONS: 'extensions_module-extensions',
	EXTENSION: 'extensions_module-extension',
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
