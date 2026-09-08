import { Injectable } from '@nestjs/common';

/**
 * Serializes one logical property's complete in-process update boundary.
 *
 * This deliberately sits above PropertyValueService's durable keyed lease. It keeps entity loading,
 * value persistence and event publication ordered for one canonical property without serializing
 * unrelated device reports. Platform calls must never be made from this coordinator.
 */
@Injectable()
export class PropertyStateCoordinatorService {
	private readonly tails = new Map<string, Promise<void>>();

	run<T>(key: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.tails.get(key) ?? Promise.resolve();
		let release: () => void = () => {};
		const ticket = new Promise<void>((resolve) => {
			release = resolve;
		});
		const tail = previous.then(
			() => ticket,
			() => ticket,
		);
		this.tails.set(key, tail);

		return previous.then(operation, operation).finally(() => {
			release();
			if (this.tails.get(key) === tail) {
				this.tails.delete(key);
			}
		});
	}
}
