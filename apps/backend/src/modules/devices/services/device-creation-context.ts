import { EntityManager } from 'typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';

const admitted = new WeakSet<DeviceCreationContext>();
const admission = Symbol('internal-device-creation');
const logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceCreationContext');

/** Internal transaction capability. Public DTOs cannot select a manager or publication callback. */
export class DeviceCreationContext {
	private readonly publications: { publish: () => Promise<void> | void; requiresActivation: boolean }[] = [];
	private active = true;

	private constructor(
		readonly manager: EntityManager,
		private readonly allowedType: string,
		capability: symbol,
	) {
		if (capability !== admission || !manager.queryRunner?.isTransactionActive)
			throw new Error('Device creation requires an admitted transaction');
		admitted.add(this);
	}

	/** Commits the admitted catalog before activating it and isolating each subsequent publication failure. */
	static async run<T>(
		writer: (operation: (manager: EntityManager) => Promise<T>) => Promise<T>,
		allowedType: string,
		operation: (context: DeviceCreationContext) => Promise<T>,
		afterCommit: (result: T) => Promise<void> | void,
		outputPropertyId?: string,
	): Promise<T> {
		let context: DeviceCreationContext;
		const result = await writer(async (manager) => {
			context = new DeviceCreationContext(manager, allowedType, admission);
			try {
				return await operation(context);
			} finally {
				context.active = false;
			}
		});
		if (context.manager.queryRunner?.isTransactionActive)
			throw new Error('Device creation publications require the owning COMMIT');
		// Only a successful owning writer returns. Rollback never reaches the callbacks or lease installation.
		const failures: { stage: string; error: unknown }[] = [];
		let activated = false;
		try {
			await afterCommit(result);
			activated = true;
		} catch (error) {
			failures.push({ stage: 'activation', error });
		}
		for (const publication of context.publications) {
			// Property hooks may install a fallback lease with incomplete metadata when activation failed.
			if (publication.requiresActivation && !activated) continue;
			try {
				await publication.publish();
			} catch (error) {
				failures.push({ stage: 'publication', error });
			}
		}
		context.publications.length = 0;
		for (const failure of failures)
			logger.error(
				`Device creation committed for ${allowedType}${outputPropertyId ? ` output=${outputPropertyId}` : ''}, but post-commit ${failure.stage} failed`,
				failure.error instanceof Error
					? failure.error
					: new Error('Post-commit callback rejected', { cause: failure.error }),
			);
		return result;
	}

	/** Refuses use outside the admitted integration and active transaction. */
	assertType(type: string): void {
		if (
			!admitted.has(this) ||
			!this.active ||
			!this.manager.queryRunner?.isTransactionActive ||
			type !== this.allowedType
		)
			throw new Error('Device creation context is not active for this integration');
	}

	/** Queues a callback for COMMIT; activation-dependent property hooks are suppressed if activation fails. */
	defer(publication: () => Promise<void> | void, requiresActivation = false): void {
		this.assertType(this.allowedType);
		this.publications.push({ publish: publication, requiresActivation });
	}
}
