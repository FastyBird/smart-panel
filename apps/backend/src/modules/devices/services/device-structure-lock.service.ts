import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

/**
 * Serializes the writes that decide a device's structure against each other.
 *
 * A structural rule spans rows that no single statement touches. `assertCategoryChangeSafe` judges a
 * device's channels and properties against the category a PATCH is about to store, and the plugin
 * hooks on channel and property writes judge the row being written against the category the device
 * currently has. Each reads what the other is about to change, and several awaited round trips
 * separate every one of those reads from its own write — so a property created against the old
 * category can commit after the category change was judged and before it is stored, leaving a device
 * advertising a category its own structure does not satisfy, with neither request having done
 * anything wrong on its own.
 *
 * A transaction is the wrong instrument here. The backend runs on one shared SQLite connection, so a
 * transaction held across awaits collects whatever statements other requests happen to issue in that
 * window — the hazard `VirtualIndexMaintenanceListener.deferPastOpenTransaction` already exists to
 * work around. This is a single process, so an in-process queue closes the window completely, which
 * is the same reason `SuggestionEngineService.withMutex` serializes its own check-then-insert.
 *
 * Re-entrant on purpose. Creating a device creates its channels, and creating a channel creates its
 * properties, so these windows nest: a nested call that took a fresh ticket would wait for one only
 * its own caller can release. The holder is tracked per async call chain rather than by a flag, so a
 * *concurrent* request is still queued while a nested one passes straight through.
 */
@Injectable()
export class DeviceStructureLockService {
	private readonly context = new AsyncLocalStorage<LockContext>();
	private readonly queue: LockRequest<unknown>[] = [];
	private activeReaders = 0;
	private writerActive = false;

	async runShared<T>(fn: () => Promise<T>): Promise<T> {
		const context = this.context.getStore();

		// An exclusive operation already excludes structural writers. A nested shared operation must not
		// wait behind its own caller. The same is true for a nested report operation on this chain.
		if (context?.active) {
			return this.runNested(context, fn);
		}

		return this.enqueue('shared', fn);
	}

	async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		const context = this.context.getStore();

		if (context?.active) {
			if (context.mode === 'shared') {
				throw new Error('Device structure lock cannot be upgraded from shared to exclusive');
			}

			return this.runNested(context, fn);
		}

		return this.enqueue('exclusive', fn);
	}

	private enqueue<T>(mode: LockMode, fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({ mode, fn, resolve, reject });
			this.drain();
		});
	}

	private drain(): void {
		if (this.writerActive || this.queue.length === 0) {
			return;
		}

		const next = this.queue[0];

		if (next.mode === 'exclusive') {
			if (this.activeReaders !== 0) {
				return;
			}

			this.queue.shift();
			this.writerActive = true;
			this.execute(next);

			return;
		}

		// Admit every reader already ahead of the first writer. Once an exclusive request is queued,
		// later readers stay queued, which prevents a continuous report stream from starving deletion.
		while (this.queue[0]?.mode === 'shared') {
			const reader = this.queue.shift();

			if (!reader) {
				return;
			}

			this.activeReaders += 1;
			this.execute(reader);
		}
	}

	private execute<T>(request: LockRequest<T>): void {
		const context: LockContext = { mode: request.mode, active: true, nestedOperations: new Set() };

		void Promise.resolve()
			.then(() => this.context.run(context, request.fn))
			.then(
				async (value) => {
					await this.waitForNestedOperations(context);
					request.resolve(value);
				},
				async (error: unknown) => {
					await this.waitForNestedOperations(context);
					request.reject(error);
				},
			)
			.finally(() => {
				// AsyncLocalStorage context can survive into a detached callback. Marking its lease inactive
				// prevents that callback from bypassing a later writer after the original operation returns.
				context.active = false;

				if (request.mode === 'exclusive') {
					this.writerActive = false;
				} else {
					this.activeReaders -= 1;
				}

				this.drain();
			});
	}

	private runNested<T>(context: LockContext, fn: () => Promise<T>): Promise<T> {
		let operation: Promise<T>;

		try {
			operation = Promise.resolve(fn());
		} catch (error) {
			operation = Promise.reject(error);
		}

		context.nestedOperations.add(operation);
		void operation.then(
			() => context.nestedOperations.delete(operation),
			() => context.nestedOperations.delete(operation),
		);

		return operation;
	}

	private async waitForNestedOperations(context: LockContext): Promise<void> {
		while (context.nestedOperations.size > 0) {
			await Promise.allSettled(context.nestedOperations);
		}
	}
}

type LockMode = 'shared' | 'exclusive';

interface LockContext {
	mode: LockMode;
	active: boolean;
	nestedOperations: Set<Promise<unknown>>;
}

interface LockRequest<T> {
	mode: LockMode;
	fn: () => Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
}
