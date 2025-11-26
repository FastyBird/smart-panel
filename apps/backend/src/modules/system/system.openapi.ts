/**
 * OpenAPI transformations for System module
 * This file registers module-specific OpenAPI spec transformations
 */
import { openApiTransformRegistry } from '../../common/decorators/openapi-transform.decorator';

import { SYSTEM_MODULE_PREFIX } from './system.constants';

// Register transformations when this module is loaded
openApiTransformRegistry.register((document) => {
	// Fix path parameter names to match original spec
	const assetPath = `/${SYSTEM_MODULE_PREFIX}/extensions/assets/{pkg}/{path}`;
	if (document.paths && typeof document.paths === 'object') {
		const paths = document.paths as Record<string, unknown>;
		if (paths[assetPath]) {
			const pathItem = paths[assetPath] as Record<string, unknown>;
			// Rename path to asset_path in all operations
			for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
				if ((pathItem[method] as { parameters?: Array<{ in?: string; name?: string }> })?.parameters) {
					for (const param of (pathItem[method] as { parameters?: Array<{ in?: string; name?: string }> }).parameters ||
						[]) {
						if (param.in === 'path' && param.name === 'path') {
							param.name = 'asset_path';
						}
					}
				}
			}
			// Also rename the path itself
			const assetPathWithAssetPath = `/${SYSTEM_MODULE_PREFIX}/extensions/assets/{pkg}/{asset_path}`;
			paths[assetPathWithAssetPath] = paths[assetPath];
			delete paths[assetPath];
		}
	}
});
