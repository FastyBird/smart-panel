import { Injectable, Logger, Scope } from '@nestjs/common';

/**
 * Extension-specific logger that provides consistent log message formatting
 * across all extension plugins.
 *
 * Log messages are formatted as: [extension-type][ComponentName] message
 * The tag field is set to the extension type for filtering.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   private readonly logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
 *
 *   doSomething() {
 *     this.logger.log('Something happened');
 *     // Output: [devices-shelly-ng-plugin][ShellyService] Something happened
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
	log(message: string, context?: Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		this.logger.log(formattedMessage, context ?? {}, this.extensionType);
	}

	/**
	 * Log an error message.
	 */
	error(message: string, context?: Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		this.logger.error(formattedMessage, context ?? {}, this.extensionType);
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, context?: Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		this.logger.warn(formattedMessage, context ?? {}, this.extensionType);
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, context?: Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		this.logger.debug?.(formattedMessage, context ?? {}, this.extensionType);
	}

	/**
	 * Log a verbose message.
	 */
	verbose(message: string, context?: Record<string, unknown>): void {
		const formattedMessage = this.formatMessage(message);
		this.logger.verbose?.(formattedMessage, context ?? {}, this.extensionType);
	}

	/**
	 * Format the message with the extension prefix.
	 * Output: [extension-type][ComponentName] message
	 */
	private formatMessage(message: string): string {
		return `[${this.extensionType}][${this.componentName}] ${message}`;
	}
}

/**
 * Factory function to create an extension logger with context.
 *
 * @example
 * ```typescript
 * const logger = createExtensionLogger('devices-shelly-ng-plugin', 'ShellyService');
 * logger.log('Starting service');
 * // Output: [devices-shelly-ng-plugin][ShellyService] Starting service
 * ```
 */
export function createExtensionLogger(extensionType: string, componentName: string): ExtensionLoggerService {
	const logger = new ExtensionLoggerService();
	logger.setContext(extensionType, componentName);
	return logger;
}
