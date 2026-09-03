import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import type { CreateNotificationInput } from '@fastybird/smart-panel-extension-sdk';

import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

const EXAMPLE_ISSUE_KEY = 'example-condition';

/**
 * Demonstrates the emitter side of the backend's notifications module: raise an issue when
 * a condition starts (`onModuleInit`, standing in for whatever real trigger your extension
 * has), resolve it when the condition ends (`onModuleDestroy`, standing in for a service's
 * own `stop()`). See `docs/notifications.md` for the full contract - the lifecycle table,
 * validation and truncation rules, `sanitizeErrorMessage()`, and `resolveAll(source)`.
 *
 * Injecting the real service: `NotificationsModule` is `@Global()`, so a plugin compiled as
 * part of the backend (`apps/backend/src/plugins/**`) reaches it with a plain constructor
 * parameter, no `imports` entry needed:
 *
 * ```ts
 * constructor(private readonly notifications: NotificationsService) {}
 * ```
 *
 * where `NotificationsService` comes from
 * `apps/backend/src/modules/notifications/services/notifications.service.ts`. This package
 * is an installable extension, compiled and published outside the backend's own TypeScript
 * program (its only runtime dependency is `@nestjs/common`), so it has no import path to
 * that concrete class, and the SDK does not yet publish an injection token for it - wiring
 * that up is a separate task. Until then, this method builds and logs the exact
 * `CreateNotificationInput` payload a real emitter would pass to `notify()`, typed against
 * the SDK's plain mirror of that contract so the shape stays correct.
 */
@Injectable()
export class ExampleService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ExampleService.name);

	onModuleInit(): void {
		const input: CreateNotificationInput = {
			source: EXAMPLE_EXTENSION_PLUGIN_NAME,
			kind: 'issue',
			key: EXAMPLE_ISSUE_KEY,
			severity: 'info',
			title: 'Example extension started',
			message: 'Demonstrates an issue raised by the example extension. Resolved on shutdown.',
			actions: [{ type: 'link', label: 'Open extensions', url: '/extensions', primary: true }],
		};

		// A real emitter compiled into the backend: `await this.notifications.notify(input);`
		this.logger.log(`[EXAMPLE EXTENSION] would call notify(): ${JSON.stringify(input)}`);
	}

	onModuleDestroy(): void {
		// A real emitter compiled into the backend:
		// `await this.notifications.resolve(EXAMPLE_EXTENSION_PLUGIN_NAME, EXAMPLE_ISSUE_KEY);`
		this.logger.log(
			`[EXAMPLE EXTENSION] would call resolve(): source=${EXAMPLE_EXTENSION_PLUGIN_NAME} key=${EXAMPLE_ISSUE_KEY}`,
		);
	}
}
