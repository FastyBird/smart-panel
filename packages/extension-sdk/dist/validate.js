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
    return kindOk && routeOk && exportOk;
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