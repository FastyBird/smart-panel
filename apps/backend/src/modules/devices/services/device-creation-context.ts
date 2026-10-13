import { EntityManager } from 'typeorm';

const admitted = new WeakSet<DeviceCreationContext>();

/** Internal transaction capability. Public DTOs cannot select a manager or publication callback. */
export class DeviceCreationContext {
	private readonly publications: (() => Promise<void> | void)[] = [];
	private active = true;

	private constructor(
		readonly manager: EntityManager,
		private readonly allowedType: string,
	) {
		if (!manager.queryRunner?.isTransactionActive) throw new Error('Device creation requires an admitted transaction');
		admitted.add(this);
	}

	static async run<T>(
		writer: (operation: (manager: EntityManager) => Promise<T>) => Promise<T>,
		allowedType: string,
		operation: (context: DeviceCreationContext) => Promise<T>,
		afterCommit: (result: T) => Promise<void> | void,
	): Promise<T> {
		let context: DeviceCreationContext;
		const result = await writer(async (manager) => {
			context = new DeviceCreationContext(manager, allowedType);
			try {
				return await operation(context);
			} finally {
				context.active = false;
			}
		});
		if (context.manager.queryRunner?.isTransactionActive)
			throw new Error('Device creation publications require the owning COMMIT');
		// Only a successful owning writer returns. Rollback never reaches the callbacks or lease installation.
		await afterCommit(result);
		for (const publication of context.publications) await publication();
		context.publications.length = 0;
		return result;
	}

	assertType(type: string): void {
		if (
			!admitted.has(this) ||
			!this.active ||
			!this.manager.queryRunner?.isTransactionActive ||
			type !== this.allowedType
		)
			throw new Error('Device creation context is not active for this integration');
	}

	defer(publication: () => Promise<void> | void): void {
		this.assertType(this.allowedType);
		this.publications.push(publication);
	}
}
