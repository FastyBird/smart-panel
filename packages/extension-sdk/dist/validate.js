"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSmartPanelBackendExtensionManifest = isSmartPanelBackendExtensionManifest;
exports.isSmartPanelAdminExtensionManifest = isSmartPanelAdminExtensionManifest;
exports.normalizeRoutePrefix = normalizeRoutePrefix;
function isSmartPanelBackendExtensionManifest(v) {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const o = v;
    const kindOk = o.kind === 'module' || o.kind === 'plugin';
    const routeOk = typeof o.routePrefix === 'string' && o.routePrefix.trim().length > 0;
    const exportOk = typeof o.extensionExport === 'string' && o.extensionExport.trim().length > 0;
    const numericOk = (o.numericOperatorsExport === undefined && o.configOwnerType === undefined) ||
        (typeof o.numericOperatorsExport === 'string' &&
            /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(o.numericOperatorsExport) &&
            typeof o.configOwnerType === 'string' &&
            /^[a-z][a-z0-9-]{0,63}$/.test(o.configOwnerType));
    return kindOk && routeOk && exportOk && numericOk;
}
function isSmartPanelAdminExtensionManifest(v) {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const o = v;
    const kindOk = o.kind === 'module' || o.kind === 'plugin';
    return kindOk;
}
function normalizeRoutePrefix(route) {
    return route.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}
//# sourceMappingURL=validate.js.map