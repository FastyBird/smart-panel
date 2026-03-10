import { Injectable } from '@nestjs/common';

import { createExtensionLogger, ExtensionLoggerService } from '../../../common/logger';
import { DEVICES_MODULE_NAME } from '../devices.constants';

/**
 * Shared per-device operation queue.
 *
 * Any plugin that needs to serialize async work on a single device
 * (provisioning, mapping, delegate setup, etc.) can inject this service
 * and call `enqueue(deviceId, task)`.  Tasks for the **same** deviceId
 * are chained sequentially; tasks for **different** devices run in parallel.
 */
@Injectable()
export class DeviceProvisionQueueService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_MODULE_NAME,
		'DeviceProvisionQueueService',
	);

	private readonly locks: Map<string, Promise<unknown>> = new Map();

	/**
	 * Enqueue an async task for the given device.
	 *
	 * If another task is already running (or queued) for this device,
	 * the new task waits until all previous tasks finish, then executes.
	 * Errors from earlier tasks are swallowed so the queue keeps moving.
	 */
	enqueue<T>(deviceId: string, task: () => Promise<T>): Promise<T> {
		const previous = this.locks.get(deviceId) ?? Promise.resolve();

		const chained = previous.catch(() => undefined).then(task);

		this.locks.set(deviceId, chained);

		return chained.finally(() => {
			if (this.locks.get(deviceId) === chained) {
				this.locks.delete(deviceId);
			}
		});
	}

	/**
	 * Check whether a task is currently queued or running for the given device.
	 */
	isPending(deviceId: string): boolean {
		return this.locks.has(deviceId);
	}
}
