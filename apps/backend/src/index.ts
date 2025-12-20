/**
 * Public API for external extensions.
 *
 * External Smart Panel extensions can import from '@fastybird/smart-panel-backend':
 *
 * @example
 * ```typescript
 * import {
 *   ExtensionsService,
 *   PluginsTypeMapperService,
 *   PluginConfigModel,
 *   UpdatePluginConfigDto,
 * } from '@fastybird/smart-panel-backend';
 * ```
 *
 * Note: ExtensionsService and PluginsTypeMapperService are provided by global modules
 * (ConfigModule and ExtensionsModule), so they are available to all extensions
 * without needing to import the modules explicitly. This simplifies extension
 * development and avoids circular dependency issues.
 */

// Extensions service - for registering extension metadata (globally available)
export { ExtensionsService } from './modules/extensions/services/extensions.service';

// Config service - for registering plugin config mappings (globally available)
export { PluginsTypeMapperService } from './modules/config/services/plugins-type-mapper.service';

// Base classes for plugin config
export { PluginConfigModel } from './modules/config/models/config.model';
export { UpdatePluginConfigDto } from './modules/config/dto/config.dto';
