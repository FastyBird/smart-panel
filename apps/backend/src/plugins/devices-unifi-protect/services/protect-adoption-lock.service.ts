import { Injectable } from '@nestjs/common';

/** Runs the operations of one key one after another (FIFO); different keys run concurrently. */
@Injectable()
export class ProtectAdoptionLockService {
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
