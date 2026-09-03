import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
	NotificationsService,
} from '@fastybird/smart-panel-backend';

import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

const EXAMPLE_ISSUE_KEY = 'example-loaded';

/**
 * Demonstrates the emitter side of the backend's notifications module: raise an issue when
 * a condition starts (`onModuleInit`, standing in for whatever real trigger your extension
 * has), resolve it when the condition ends (`onModuleDestroy`, standing in for a service's
 * own `stop()`). See `docs/notifications.md` for the full contract - the lifecycle table,
 * validation and truncation rules, `sanitizeErrorMessage()`, and `resolveAll(source)`.
 *
 * `NotificationsModule` is `@Global()`, so `NotificationsService` is injected here with a
 * plain constructor parameter, no `imports` entry needed - the same way this package already
 * imports `PluginConfigModel` and `UpdatePluginConfigDto` from the backend's public barrel,
 * `@fastybird/smart-panel-backend` (`apps/backend/src/index.ts`).
 *
 * A truly external package - one with no dependency on the backend at all - types its
 * `notify()` payload against the SDK's plain mirror instead:
 * `@fastybird/smart-panel-extension-sdk`'s `CreateNotificationInput`
 * (`packages/extension-sdk/src/notification.types.ts`).
 */
@Injectable()
export class ExampleService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ExampleService.name);

	constructor(private readonly notifications: NotificationsService) {}

	async onModuleInit(): Promise<void> {
		await this.notifications.notify({
			source: EXAMPLE_EXTENSION_PLUGIN_NAME,
			kind: NotificationKind.ISSUE,
			key: EXAMPLE_ISSUE_KEY,
			severity: NotificationSeverity.INFO,
			title: 'Example extension started',
			message: 'Demonstrates an issue raised by the example extension. Resolved on shutdown.',
			actions: [{ type: NotificationActionType.LINK, label: 'Open extensions', url: '/extensions', primary: true }],
		});

		this.logger.log(`[EXAMPLE EXTENSION] raised ${EXAMPLE_ISSUE_KEY}`);
	}

	async onModuleDestroy(): Promise<void> {
		await this.notifications.resolve(EXAMPLE_EXTENSION_PLUGIN_NAME, EXAMPLE_ISSUE_KEY);

		this.logger.log(`[EXAMPLE EXTENSION] resolved ${EXAMPLE_ISSUE_KEY}`);
	}
}
