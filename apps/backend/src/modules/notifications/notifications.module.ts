import { Global, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateNotificationsConfigDto } from './dto/update-config.dto';
import { NotificationEntity } from './entities/notifications.entity';
import { NotificationsConfigModel } from './models/config.model';
import {
	NOTIFICATIONS_MODULE_API_TAG_DESCRIPTION,
	NOTIFICATIONS_MODULE_API_TAG_NAME,
	NOTIFICATIONS_MODULE_NAME,
} from './notifications.constants';
import { NOTIFICATIONS_SWAGGER_EXTRA_MODELS } from './notifications.openapi';
import { NotificationInputValidator } from './services/notification-input.validator';
import { NotificationsRetentionService } from './services/notifications-retention.service';
import { NotificationsService } from './services/notifications.service';

@ApiTag({
	tagName: NOTIFICATIONS_MODULE_NAME,
	displayName: NOTIFICATIONS_MODULE_API_TAG_NAME,
	description: NOTIFICATIONS_MODULE_API_TAG_DESCRIPTION,
})
// Global so an emitter anywhere in the backend can inject NotificationsService without
// adding this module to its own imports, which would mean a forwardRef in both directions.
@Global()
@Module({
	imports: [TypeOrmModule.forFeature([NotificationEntity]), SwaggerModule],
	providers: [NotificationInputValidator, NotificationsService, NotificationsRetentionService],
	exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register configuration mapping
		this.modulesMapperService.registerMapping<NotificationsConfigModel, UpdateNotificationsConfigDto>({
			type: NOTIFICATIONS_MODULE_NAME,
			class: NotificationsConfigModel,
			configDto: UpdateNotificationsConfigDto,
		});

		// Register Swagger models
		for (const model of NOTIFICATIONS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata for this module
		this.extensionsService.registerModuleMetadata({
			type: NOTIFICATIONS_MODULE_NAME,
			name: 'Notifications',
			description: 'System notifications, their lifecycle and forwarding to external channels',
			author: 'FastyBird',
			readme: `# Notifications

> Module · by FastyBird

One place where the system tells the administrator what needs attention: an integration lost its connection, a managed service failed, an update is available, somebody failed to log in. Conditions that used to exist only as log lines become records with a severity, a source, a call to action and a read/dismiss lifecycle.

## What it gives you

- A single inbox for everything that wants the administrator's attention, instead of a badge per feature
- Notifications that clear themselves: an integration raises an issue when it disconnects and resolves it when it reconnects, so the list is the current state of the system rather than a log
- Calls to action that point at endpoints that already exist — restart the failing service, open the update page — so acting on a notification is one click

## Features

- **Two kinds, one table** — \`event\` rows record something that happened, \`issue\` rows a condition that holds until its source resolves it
- **Four severities** — \`info\`, \`warning\`, \`error\` and \`critical\`; channels filter on them and the admin sorts by them
- **Deduplication** — repeats of the same \`(source, key)\` fold into one row with an occurrence count, so a reconnect loop is one line, not a hundred
- **Boot cleanup** — non-persistent issues are resolved when the backend starts, so a condition that cleared while the process was down does not linger
- **Retention and caps** — dismissed and resolved rows are deleted after \`retention_days\`; active events are bounded by \`max_notifications\`, oldest read first. Issues are never evicted
- **Rate guard** — at most 60 notifications per source per minute, so a spinning emitter cannot flood the table or the configured channels
- **Real-time push** — creation, update and deletion are broadcast over WebSocket to the admin, which fetches the row through the guarded REST endpoint

## Configuration

- \`retention_days\` — how long dismissed and resolved notifications are kept (1–365, default 30)
- \`max_notifications\` — upper bound on active event notifications (50–5000, default 500)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
