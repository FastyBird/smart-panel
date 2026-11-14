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
 *   NotificationsService,
 *   PluginConfigModel,
 *   UpdatePluginConfigDto,
 * } from '@fastybird/smart-panel-backend';
 * ```
 *
 * Note: ExtensionsService, PluginsTypeMapperService, NotificationsService and
 * NotificationChannelRegistryService are provided by global modules (ConfigModule,
 * ExtensionsModule and NotificationsModule), so they are available to all extensions
 * without needing to import the modules explicitly. This simplifies extension
 * development and avoids circular dependency issues.
 *
 * AutomationNodeTypeRegistryService is not global: an extension that adds automation cards
 * imports AutomationsModule into its own module first.
 */

// Extensions service - for registering extension metadata (globally available)
export { ExtensionsService } from './modules/extensions/services/extensions.service';

// Config service - for registering plugin config mappings (globally available)
export { PluginsTypeMapperService } from './modules/config/services/plugins-type-mapper.service';

// Base classes for plugin config
export { PluginConfigModel } from './modules/config/models/config.model';
export { UpdatePluginConfigDto } from './modules/config/dto/config.dto';

// Notifications service - for raising (notify) and clearing (resolve/resolveAll)
// notifications; see docs/notifications.md (globally available)
export { NotificationsService } from './modules/notifications/services/notifications.service';

// Notification channel registry - for registering a channel plugin's send() (globally available)
export { NotificationChannelRegistryService } from './modules/notifications/services/notification-channel-registry.service';

// Notification channel platform contract - base class, interface and thrown-error shape
// a channel plugin implements to forward notifications somewhere else
export {
	BaseNotificationChannel,
	ChannelDeliveryError,
	INotificationChannel,
} from './modules/notifications/platforms/notification-channel.platform';

// Strips secrets and reduces URLs before an operational error reaches a notification message
export { sanitizeErrorMessage } from './modules/notifications/notifications.utils';

// Notification enums - kind, severity and action type
export {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from './modules/notifications/notifications.constants';

// Automations module - import it into an extension module that registers automation cards, then inject
// the node type registry and register the cards in onModuleInit; see docs/extensions.md, "Adding automation
// cards". Type the cards against the SDK's mirrors (`@fastybird/smart-panel-extension-sdk`).
export { AutomationsModule } from './modules/automations/automations.module';
export { AutomationNodeTypeRegistryService } from './modules/automations/services/node-type-registry.service';
