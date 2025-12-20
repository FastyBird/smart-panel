import { Injectable } from '@nestjs/common';

import { ModuleStatsModel } from '../../stats/models/stats.model';
import { StatsProvider } from '../../stats/stats.interfaces';
import { PluginServiceManagerService } from '../services/plugin-service-manager.service';

/**
 * Stats provider for the extensions module.
 *
 * Exposes plugin service metrics for monitoring via Prometheus and REST API.
 *
 * Metrics exposed:
 * - services_total: Total number of registered services
 * - services_running: Number of services in 'started' state
 * - services_stopped: Number of services in 'stopped' state
 * - services_error: Number of services in 'error' state
 * - services_healthy: Number of healthy services
 * - services_unhealthy: Number of unhealthy services
 *
 * Per-service metrics (with plugin_name and service_id labels in Prometheus):
 * - service_{pluginName}_{serviceId}_state: Service state (1=started, 0=stopped, -1=error)
 * - service_{pluginName}_{serviceId}_enabled: Whether the service is enabled (1/0)
 * - service_{pluginName}_{serviceId}_healthy: Whether the service is healthy (1/0/-1 for unknown)
 * - service_{pluginName}_{serviceId}_uptime_ms: Service uptime in milliseconds
 * - service_{pluginName}_{serviceId}_start_count: Number of times the service has started
 */
@Injectable()
export class ExtensionsStatsProvider implements StatsProvider {
	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {}

	async getStats(): Promise<ModuleStatsModel> {
		const statuses = await this.pluginServiceManager.getStatus();
		const now = new Date();

		// Aggregate counts
		let running = 0;
		let stopped = 0;
		let error = 0;
		let healthy = 0;
		let unhealthy = 0;

		const stats: ModuleStatsModel = {};

		// Add aggregate metrics
		for (const status of statuses) {
			// Count by state
			if (status.state === 'started') {
				running++;
			} else if (status.state === 'stopped') {
				stopped++;
			} else if (status.state === 'error') {
				error++;
			}

			// Count by health
			if (status.healthy === true) {
				healthy++;
			} else if (status.healthy === false) {
				unhealthy++;
			}

			// Per-service metrics
			const key = this.sanitizeKey(`${status.pluginName}_${status.serviceId}`);

			// State as numeric: 1=started, 0=stopped, -1=error, 0.5=starting/stopping
			let stateValue = 0;
			if (status.state === 'started') {
				stateValue = 1;
			} else if (status.state === 'error') {
				stateValue = -1;
			} else if (status.state === 'starting' || status.state === 'stopping') {
				stateValue = 0.5;
			}

			stats[`service_${key}_state`] = {
				value: stateValue,
				last_updated: now.toISOString(),
			};

			stats[`service_${key}_enabled`] = {
				value: status.enabled ? 1 : 0,
				last_updated: now.toISOString(),
			};

			stats[`service_${key}_healthy`] = {
				value: status.healthy === true ? 1 : status.healthy === false ? 0 : -1,
				last_updated: now.toISOString(),
			};

			stats[`service_${key}_uptime_ms`] = {
				value: status.uptimeMs ?? 0,
				last_updated: now.toISOString(),
			};

			stats[`service_${key}_start_count`] = {
				value: status.startCount,
				last_updated: now.toISOString(),
			};
		}

		// Add aggregate metrics at the top
		stats['services_total'] = {
			value: statuses.length,
			last_updated: now.toISOString(),
		};

		stats['services_running'] = {
			value: running,
			last_updated: now.toISOString(),
		};

		stats['services_stopped'] = {
			value: stopped,
			last_updated: now.toISOString(),
		};

		stats['services_error'] = {
			value: error,
			last_updated: now.toISOString(),
		};

		stats['services_healthy'] = {
			value: healthy,
			last_updated: now.toISOString(),
		};

		stats['services_unhealthy'] = {
			value: unhealthy,
			last_updated: now.toISOString(),
		};

		return stats;
	}

	/**
	 * Sanitize key for metric naming (replace dashes with underscores)
	 */
	private sanitizeKey(key: string): string {
		return key.replace(/-/g, '_');
	}
}
