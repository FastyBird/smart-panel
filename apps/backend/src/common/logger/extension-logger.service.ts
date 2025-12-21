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
	}

	/**
	 * Log an informational message.
	 */
	log(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		this.logger.log(formattedMessage, this.extensionType);
	}

	/**
	 * Log an error message.
	 * Note: NestJS Logger.error() has signature (message, stack?, context?)
	 * We pass undefined for stack and extensionType as context.
	 */
	error(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		this.logger.error(formattedMessage, undefined, this.extensionType);
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		this.logger.warn(formattedMessage, this.extensionType);
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		this.logger.debug?.(formattedMessage, this.extensionType);
	}

	/**
	 * Log a verbose message.
	 */
	verbose(message: string, context?: string | Error | Record<string, unknown>): void {
		const formattedMessage = this.formatMessageWithContext(message, context);
		this.logger.verbose?.(formattedMessage, this.extensionType);
	}

	/**
	 * Format the message with the component prefix and optional context data.
	 * Output: [ComponentName] message {context}
	 * The extension/module type is passed separately as the tag.
	 */
	private formatMessageWithContext(message: string, context?: string | Error | Record<string, unknown>): string {
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

		// Skip empty objects
		if (Object.keys(context).length === 0) {
			return baseMessage;
		}

		try {
			return `${baseMessage} ${JSON.stringify(context)}`;
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
 * ```
 */
export function createExtensionLogger(extensionType: string, componentName: string): ExtensionLoggerService {
	const logger = new ExtensionLoggerService();
	logger.setContext(extensionType, componentName);
	return logger;
}
