/**
 * Public API for external extensions.
 *
 * External Smart Panel extensions can import from '@fastybird/smart-panel-backend':
 *
 * @example
 * ```typescript
 * import {
 *   ExtensionsModule,
 *   ExtensionsService,
 *   ConfigModule,
 *   PluginsTypeMapperService,
 *   PluginConfigModel,
 *   UpdatePluginConfigDto,
 * } from '@fastybird/smart-panel-backend';
 * ```
 */

// Extensions module - for registering extension metadata
export { ExtensionsModule } from './modules/extensions/extensions.module';
export { ExtensionsService } from './modules/extensions/services/extensions.service';

// Config module - for registering plugin config mappings
export { ConfigModule } from './modules/config/config.module';
export { PluginsTypeMapperService } from './modules/config/services/plugins-type-mapper.service';

// Base classes for plugin config
export { PluginConfigModel } from './modules/config/models/config.model';
export { UpdatePluginConfigDto } from './modules/config/dto/config.dto';
