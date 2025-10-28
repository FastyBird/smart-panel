export type ExtensionKind = 'module' | 'plugin';
export interface ClassType<T = unknown> {
    new (...args: any[]): T;
}
export interface SmartPanelBackendExtensionManifest {
    kind: ExtensionKind;
    routePrefix: string;
    extensionExport: string;
    sdkVersion?: string;
    displayName?: string;
    description?: string;
}
export interface DiscoveredBackendExtension {
    pkgName: string;
    routePrefix: string;
    extensionClass: ClassType<unknown>;
    kind: ExtensionKind;
    packageDir: string;
    displayName?: string;
    description?: string;
}
export interface SmartPanelAdminExtensionManifest {
    kind: ExtensionKind;
    importPath?: string;
    extensionExport?: string;
    sdkVersion?: string;
    extensionEntry?: string;
    displayName?: string;
    description?: string;
}
export interface DiscoveredAdminExtension {
    pkgName: string;
    importPath: string;
    extensionExport?: string;
    extensionEntry?: string;
    kind: ExtensionKind;
    packageDir: string;
    displayName?: string;
    description?: string;
}
