import type { NumericOperatorDefinition } from './numeric-operator.types.js';
export type ExtensionKind = 'module' | 'plugin';
export interface ClassType<T = unknown> {
    new (...args: any[]): T;
}
export interface SmartPanelBackendExtensionManifest {
    numericOperatorsExport?: string;
    configOwnerType?: string;
    kind: ExtensionKind;
    routePrefix: string;
    extensionExport: string;
    sdkVersion?: string;
    displayName?: string;
    description?: string;
}
export interface DiscoveredBackendExtension {
    backendExports?: readonly ClassType[];
    configOwnerType?: string;
    numericOperators?: readonly NumericOperatorDefinition[];
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
