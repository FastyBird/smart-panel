import { Command, CommandRunner } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import { PluginServiceManagerService } from '../services/plugin-service-manager.service';

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms: number | undefined): string {
	if (ms === undefined) {
		return '-';
	}

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d ${hours % 24}h`;
	}

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}

	return `${seconds}s`;
}

/**
 * Get color code for service state
 */
function getStateColor(state: string): string {
	switch (state) {
		case 'started':
			return '\x1b[32m'; // Green
		case 'starting':
		case 'stopping':
			return '\x1b[33m'; // Yellow
		case 'stopped':
			return '\x1b[90m'; // Gray
		case 'error':
			return '\x1b[31m'; // Red
		default:
			return '\x1b[0m'; // Reset
	}
}

@Command({
	name: 'services:list',
	description: 'List all managed plugin services with their status',
})
@Injectable()
export class ListServicesCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ListServicesCommand');

	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {
		super();
	}

	async run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
		const statuses = await this.pluginServiceManager.getStatus();

		if (statuses.length === 0) {
			console.log('\x1b[33m⚠️ No managed services found.\x1b[0m');

			return;
		}

		console.log('\x1b[32m\x1b[1m\n📋 Managed Plugin Services:\n\x1b[0m');

		// Table header
		console.log('\x1b[36m┌─────────────────────────────────────┬───────────┬─────────┬─────────┬────────────┐\x1b[0m');
		console.log(
			'\x1b[36m│\x1b[0m \x1b[1mService\x1b[0m                             \x1b[36m│\x1b[0m \x1b[1mState\x1b[0m     \x1b[36m│\x1b[0m \x1b[1mEnabled\x1b[0m \x1b[36m│\x1b[0m \x1b[1mHealthy\x1b[0m \x1b[36m│\x1b[0m \x1b[1mUptime\x1b[0m     \x1b[36m│\x1b[0m',
		);
		console.log('\x1b[36m├─────────────────────────────────────┼───────────┼─────────┼─────────┼────────────┤\x1b[0m');

		for (const status of statuses) {
			const serviceKey = `${status.pluginName}:${status.serviceId}`;
			const servicePadded = serviceKey.padEnd(35);
			const stateColor = getStateColor(status.state);
			const statePadded = status.state.padEnd(9);
			const enabledStr = status.enabled ? '\x1b[32myes\x1b[0m    ' : '\x1b[31mno\x1b[0m     ';
			const healthyStr =
				status.healthy === undefined ? '-      ' : status.healthy ? '\x1b[32myes\x1b[0m    ' : '\x1b[31mno\x1b[0m     ';
			const uptimeStr = formatUptime(status.uptimeMs).padEnd(10);

			console.log(
				`\x1b[36m│\x1b[0m ${servicePadded} \x1b[36m│\x1b[0m ${stateColor}${statePadded}\x1b[0m \x1b[36m│\x1b[0m ${enabledStr} \x1b[36m│\x1b[0m ${healthyStr} \x1b[36m│\x1b[0m ${uptimeStr} \x1b[36m│\x1b[0m`,
			);
		}

		console.log('\x1b[36m└─────────────────────────────────────┴───────────┴─────────┴─────────┴────────────┘\x1b[0m');
	}
}

@Command({
	name: 'services:start',
	description: 'Start a plugin service',
	arguments: '<pluginName> <serviceId>',
})
@Injectable()
export class StartServiceCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'StartServiceCommand');

	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {
		super();
	}

	async run(passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
		const pluginName = passedParams[0];
		const serviceId = passedParams[1];

		if (!pluginName || !serviceId) {
			console.error('\x1b[31m❌ Error: pluginName and serviceId are required\n');
			console.error('Usage: services:start <pluginName> <serviceId>');
			process.exit(1);
		}

		const serviceKey = `${pluginName}:${serviceId}`;

		if (!this.pluginServiceManager.isRegistered(pluginName, serviceId)) {
			console.error(`\x1b[31m❌ Error: Service ${serviceKey} not found\x1b[0m`);
			process.exit(1);
		}

		console.log(`\n\x1b[33m🔹 Starting service: \x1b[1m${serviceKey}\x1b[0m\n`);

		const success = await this.pluginServiceManager.startServiceManually(pluginName, serviceId);

		if (success) {
			console.log(`\x1b[32m✅ Service ${serviceKey} started successfully\x1b[0m\n`);
			this.logger.log(`Started service ${serviceKey}`);
		} else {
			const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);
			console.log(`\x1b[33m⚠️ Service ${serviceKey} is already ${status?.state}\x1b[0m\n`);
		}
	}
}

@Command({
	name: 'services:stop',
	description: 'Stop a plugin service',
	arguments: '<pluginName> <serviceId>',
})
@Injectable()
export class StopServiceCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'StopServiceCommand');

	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {
		super();
	}

	async run(passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
		const pluginName = passedParams[0];
		const serviceId = passedParams[1];

		if (!pluginName || !serviceId) {
			console.error('\x1b[31m❌ Error: pluginName and serviceId are required\n');
			console.error('Usage: services:stop <pluginName> <serviceId>');
			process.exit(1);
		}

		const serviceKey = `${pluginName}:${serviceId}`;

		if (!this.pluginServiceManager.isRegistered(pluginName, serviceId)) {
			console.error(`\x1b[31m❌ Error: Service ${serviceKey} not found\x1b[0m`);
			process.exit(1);
		}

		console.log(`\n\x1b[33m🔹 Stopping service: \x1b[1m${serviceKey}\x1b[0m\n`);

		const success = await this.pluginServiceManager.stopServiceManually(pluginName, serviceId);

		if (success) {
			console.log(`\x1b[32m✅ Service ${serviceKey} stopped successfully\x1b[0m\n`);
			this.logger.log(`Stopped service ${serviceKey}`);
		} else {
			const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);
			console.log(`\x1b[33m⚠️ Service ${serviceKey} is already ${status?.state}\x1b[0m\n`);
		}
	}
}

@Command({
	name: 'services:restart',
	description: 'Restart a plugin service',
	arguments: '<pluginName> <serviceId>',
})
@Injectable()
export class RestartServiceCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'RestartServiceCommand');

	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {
		super();
	}

	async run(passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
		const pluginName = passedParams[0];
		const serviceId = passedParams[1];

		if (!pluginName || !serviceId) {
			console.error('\x1b[31m❌ Error: pluginName and serviceId are required\n');
			console.error('Usage: services:restart <pluginName> <serviceId>');
			process.exit(1);
		}

		const serviceKey = `${pluginName}:${serviceId}`;

		if (!this.pluginServiceManager.isRegistered(pluginName, serviceId)) {
			console.error(`\x1b[31m❌ Error: Service ${serviceKey} not found\x1b[0m`);
			process.exit(1);
		}

		console.log(`\n\x1b[33m🔹 Restarting service: \x1b[1m${serviceKey}\x1b[0m\n`);

		const success = await this.pluginServiceManager.restartService(pluginName, serviceId);

		if (success) {
			console.log(`\x1b[32m✅ Service ${serviceKey} restarted successfully\x1b[0m\n`);
			this.logger.log(`Restarted service ${serviceKey}`);
		} else {
			const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);

			if (!status?.enabled) {
				console.error(`\x1b[31m❌ Cannot restart: Plugin ${pluginName} is disabled\x1b[0m\n`);
			} else {
				console.error(`\x1b[31m❌ Failed to restart service ${serviceKey}\x1b[0m\n`);
			}
		}
	}
}
