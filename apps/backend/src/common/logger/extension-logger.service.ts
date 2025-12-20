import { Injectable, Logger, Scope } from '@nestjs/common';

/**
 * Extension-specific logger that provides consistent log message formatting
 * across all extension plugins and modules.
 *
 * Log messages are formatted as: [ComponentName] message
 * The tag field is set to the extension/module type for filtering.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   private readonly logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
 *
 *   doSomething() {
 *     this.logger.log('Something happened');
 *     // Output: [devices-shelly-ng-plugin] [ShellyService] Something happened
 *   }
 * }
 * ```
 */
@Injectable({ scope: Scope.TRANSIENT })
export class ExtensionLoggerService {
	private logger: Logger;
	private extensionType: string = '';
	private componentName: string = '';

	constructor() {
		this.logger = new Logger();
	}

	/**
	 * Set the context for this logger instance.
	 *
	 * @param extensionType - The extension type (e.g., 'devices-shelly-ng-plugin')
	 * @param componentName - The component name (e.g., 'ShellyService', 'DeviceDelegate')
	 */
	setContext(extensionType: string, componentName: string): void {
		this.extensionType = extensionType;
		this.componentName = componentName;
		// Use componentName as NestJS context for cleaner display
		this.logger = new Logger(componentName);
	}

	/**
	 * Log an informational message.
	 */
	log(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		const ctx = this.normalizeContext(context);
		if (ctx) {
			this.logger.log(formattedMessage, ctx, this.extensionType);
		} else {
			this.logger.log(formattedMessage, this.extensionType);
		}
	}

	/**
	 * Log an error message.
	 */
	error(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		const ctx = this.normalizeContext(context);
		if (ctx) {
			this.logger.error(formattedMessage, ctx, this.extensionType);
		} else {
			this.logger.error(formattedMessage, this.extensionType);
		}
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		const ctx = this.normalizeContext(context);
		if (ctx) {
			this.logger.warn(formattedMessage, ctx, this.extensionType);
		} else {
			this.logger.warn(formattedMessage, this.extensionType);
		}
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		const ctx = this.normalizeContext(context);
		if (ctx) {
			this.logger.debug?.(formattedMessage, ctx, this.extensionType);
		} else {
			this.logger.debug?.(formattedMessage, this.extensionType);
		}
	}

	/**
	 * Log a verbose message.
	 */
	verbose(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		const ctx = this.normalizeContext(context);
		if (ctx) {
			this.logger.verbose?.(formattedMessage, ctx, this.extensionType);
		} else {
			this.logger.verbose?.(formattedMessage, this.extensionType);
		}
	}

	/**
	 * Normalize context to a Record<string, unknown> or undefined if empty.
	 * Handles string (for stack traces), Error objects, and object contexts.
	 * Returns undefined when no meaningful context is provided.
	 */
	private normalizeContext(context?: string | Error | Record<string, unknown>): Record<string, unknown> | undefined {
		if (!context) {
			return undefined;
		}
		if (typeof context === 'string') {
			return { stack: context };
		}
		if (context instanceof Error) {
			return { message: context.message, stack: context.stack };
		}
		// Return undefined for empty objects
		if (Object.keys(context).length === 0) {
			return undefined;
		}
		return context;
	}

	/**
	 * Format the message with the component prefix.
	 * Output: [ComponentName] message
	 * The extension/module type is passed separately as the tag.
	 */
	private formatMessage(message: string): string {
		return `[${this.componentName}] ${message}`;
	}
}

/**
 * Factory function to create an extension logger with context.
 *
 * @example
 * ```typescript
 * const logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
 * logger.log('Starting service');
 * // Output: [devices-shelly-ng-plugin] [ShellyService] Starting service
 * ```
 */
export function createExtensionLogger(extensionType: string, componentName: string): ExtensionLoggerService {
	const logger = new ExtensionLoggerService();
	logger.setContext(extensionType, componentName);
	return logger;
}
