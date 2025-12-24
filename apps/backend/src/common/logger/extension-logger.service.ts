import { Injectable, Logger, Scope } from '@nestjs/common';

/**
 * Context options for log messages.
 */
export interface LogContext {
	/** Resource ID (device, channel, property, etc.) to associate with the log entry */
	resource?: string;
	/** Additional context data */
	[key: string]: unknown;
}

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
 *
 *     // With resource context for filtering
 *     this.logger.log('Device updated', { resource: device.id });
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
	}

	/**
	 * Log an informational message.
	 */
	log(message: string, context?: string | Error | LogContext): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		const logContext = this.buildLogContext(context);
		this.logger.log(formattedMessage, logContext);
	}

	/**
	 * Log an error message.
	 * Note: NestJS Logger.error() has signature (message, stack?, context?)
	 * We pass undefined for stack and extensionType as context.
	 */
	error(message: string, context?: string | Error | LogContext): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		const logContext = this.buildLogContext(context);
		this.logger.error(formattedMessage, undefined, logContext);
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, context?: string | Error | LogContext): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		const logContext = this.buildLogContext(context);
		this.logger.warn(formattedMessage, logContext);
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, context?: string | Error | LogContext): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		const logContext = this.buildLogContext(context);
		this.logger.debug?.(formattedMessage, logContext);
	}

	/**
	 * Log a verbose message.
	 */
	verbose(message: string, context?: string | Error | LogContext): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		const logContext = this.buildLogContext(context);
		this.logger.verbose?.(formattedMessage, logContext);
	}

	/**
	 * Build the log context object that will be passed to the underlying logger.
	 * This ensures resource ID and other context is properly passed through.
	 */
	private buildLogContext(context?: string | Error | LogContext): Record<string, unknown> | string {
		const baseContext: Record<string, unknown> = {
			tag: this.extensionType,
		};

		if (!context) {
			return baseContext;
		}

		if (typeof context === 'string') {
			return baseContext;
		}

		if (context instanceof Error) {
			return baseContext;
		}

		// Merge resource and other context properties
		if (context.resource) {
			baseContext.resource = context.resource;
		}

		return baseContext;
	}

	/**
	 * Format the message with the component prefix and optional context data.
	 * Output: [ComponentName] message {context}
	 * The extension/module type is passed separately as the tag.
	 */
	private formatMessageWithContext(message: string, context?: string | Error | LogContext): string {
		const baseMessage = `[${this.componentName}] ${message}`;

		if (!context) {
			return baseMessage;
		}

		if (typeof context === 'string') {
			return `${baseMessage} ${context}`;
		}

		if (context instanceof Error) {
			const errorInfo = context.stack || context.message;
			return `${baseMessage} ${errorInfo}`;
		}

		// Filter out 'resource' from displayed context (it's passed separately)
		const displayContext = { ...context };
		delete displayContext.resource;

		// Skip empty objects
		if (Object.keys(displayContext).length === 0) {
			return baseMessage;
		}

		try {
			return `${baseMessage} ${JSON.stringify(displayContext)}`;
		} catch {
			return baseMessage;
		}
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
 *
 * // With resource context
 * logger.log('Device connected', { resource: device.id });
 * ```
 */
export function createExtensionLogger(extensionType: string, componentName: string): ExtensionLoggerService {
	const logger = new ExtensionLoggerService();
	logger.setContext(extensionType, componentName);
	return logger;
}
