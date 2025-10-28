import type { SmartPanelAdminExtensionManifest, SmartPanelBackendExtensionManifest } from './types.js';
export declare function isSmartPanelBackendExtensionManifest(v: unknown): v is SmartPanelBackendExtensionManifest;
export declare function isSmartPanelAdminExtensionManifest(v: unknown): v is SmartPanelAdminExtensionManifest;
export declare function normalizeRoutePrefix(route: string): string;
