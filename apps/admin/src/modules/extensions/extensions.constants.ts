import { ExtensionKind, ExtensionSource, ExtensionSurface } from '../../openapi.constants';

export { ExtensionKind, ExtensionSource, ExtensionSurface };

export const EXTENSIONS_MODULE_PREFIX = 'extensions';

export const EXTENSIONS_MODULE_NAME = 'extensions-module';

export const EXTENSIONS_MODULE_EVENT_PREFIX = 'ExtensionsModule.';

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
	EXTENSION_DETAIL: 'extensions_module-extension-detail',
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_VIEW_MODE = 'table' as const;
