import { AsyncLocalStorage } from 'node:async_hooks';
import { type ChildProcess } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { TAILSCALE_CHILD_KILL_GRACE_MS, TAILSCALE_CHILD_TERM_GRACE_MS } from '../remote-access-tailscale.constants';
import {
	TailscaleChildTerminationException,
	TailscaleOperationCancelledException,
	TailscaleOperationInProgressException,
} from '../remote-access-tailscale.exceptions';

export type TailscaleOperation =
	| 'connect'
	| 'disconnect'
	| 'reconnect'
	| 'login'
	| 'logout'
	| 'preferences'
	| 'config'
	| 'serve'
	| 'reset'
	| 'shutdown';

export interface TailscaleOperationToken {
	generation: number;
	signal: AbortSignal;
}

interface ActiveOperation {
	name: TailscaleOperation;
	token: TailscaleOperationToken;
	abort: AbortController;
}

/** A provider-local mutation owner. Terminal actions revoke ownership synchronously, before awaiting children. */
@Injectable()
export class TailscaleOperationCoordinatorService {
	private generation = 0;
	private observationRevision = 0;
	private settledHandler: ((operation: TailscaleOperation) => void) | null = null;
	private active: ActiveOperation | null = null;
	private readonly context = new AsyncLocalStorage<TailscaleOperationToken>();
	private readonly children = new Map<ChildProcess, Promise<void>>();
	private readonly terminations = new Map<ChildProcess, Promise<void>>();

	getGeneration(): number {
		return this.generation;
	}

	getObservationRevision(): number {
		return this.observationRevision;
	}

	isObservationCurrent(revision: number): boolean {
		return revision === this.observationRevision;
	}

	onSettled(handler: (operation: TailscaleOperation) => void): void {
		this.settledHandler = handler;
	}

	getOperation(): TailscaleOperation | null {
		return this.active?.name ?? null;
	}

	hasPendingChildren(): boolean {
		return this.children.size > 0;
	}

	withoutOperation<T>(work: () => T): T {
		return this.context.exit(work);
	}

	isCurrent(generation: number): boolean {
		return generation === this.generation;
	}

	assertCurrent(token: TailscaleOperationToken | undefined = this.context.getStore()): void {
		if (token && (token.signal.aborted || !this.isCurrent(token.generation) || this.active?.token !== token)) {
			throw new TailscaleOperationCancelledException();
		}
	}

	getToken(): TailscaleOperationToken | undefined {
		return this.context.getStore();
	}

	run<T>(
		name: TailscaleOperation,
		work: (token: TailscaleOperationToken) => Promise<T>,
		invalidateObservations = true,
	): Promise<T> {
		const nested = this.context.getStore();

		if (nested) {
			this.assertCurrent(nested);

			return work(nested);
		}

		if (this.active || this.children.size > 0) {
			return Promise.reject(new TailscaleOperationInProgressException());
		}

		return this.execute(name, work, invalidateObservations);
	}

	/** Cancels the previous owner instead of joining a login's ten-minute promise. */
	interrupt<T>(name: TailscaleOperation, work: (token: TailscaleOperationToken) => Promise<T>): Promise<T> {
		this.generation++;
		this.active?.abort.abort();

		return this.execute(name, async (token) => {
			await this.reapPendingChildren();
			this.assertCurrent(token);

			return work(token);
		});
	}

	private async execute<T>(
		name: TailscaleOperation,
		work: (token: TailscaleOperationToken) => Promise<T>,
		invalidateObservations = true,
	): Promise<T> {
		if (invalidateObservations) {
			this.observationRevision++;
		}
		const abort = new AbortController();
		const owner: ActiveOperation = { name, abort, token: { generation: this.generation, signal: abort.signal } };
		this.active = owner;
		let onAbort: () => void;
		const cancelled = new Promise<never>((_, reject) => {
			onAbort = () => reject(new TailscaleOperationCancelledException());
			abort.signal.addEventListener('abort', onAbort, { once: true });
		});

		try {
			return await Promise.race([this.context.run(owner.token, () => work(owner.token)), cancelled]);
		} finally {
			abort.signal.removeEventListener('abort', onAbort);
			if (invalidateObservations) {
				this.observationRevision++;
			}
			if (this.active === owner) {
				this.active = null;
				if (invalidateObservations) {
					this.withoutOperation(() => this.settledHandler?.(name));
				}
			}
		}
	}

	/** Tracking lasts until close, not merely exit: close proves the pipes and process were reaped. */
	trackChild(child: ChildProcess): Promise<void> {
		this.assertCurrent();
		const existing = this.children.get(child);
		if (existing !== undefined) {
			return existing;
		}
		const closed = new Promise<void>((resolve) => {
			child.once('close', () => {
				this.children.delete(child);
				resolve();
			});
		});
		this.children.set(child, closed);

		return closed;
	}

	terminateChild(child: ChildProcess): Promise<void> {
		const existing = this.terminations.get(child);
		if (existing !== undefined) {
			return existing;
		}
		const termination = this.reapChild(child).finally(() => this.terminations.delete(child));
		this.terminations.set(child, termination);
		return termination;
	}

	private async reapChild(child: ChildProcess): Promise<void> {
		const closed = this.children.get(child);
		if (closed === undefined) {
			return;
		}
		child.kill('SIGTERM');
		if (await this.waitClosed(closed, TAILSCALE_CHILD_TERM_GRACE_MS)) {
			return;
		}
		child.kill('SIGKILL');
		if (!(await this.waitClosed(closed, TAILSCALE_CHILD_KILL_GRACE_MS))) {
			throw new TailscaleChildTerminationException();
		}
	}

	async reapPendingChildren(): Promise<void> {
		const results = await Promise.allSettled([...this.children.keys()].map((child) => this.terminateChild(child)));
		if (results.some((result) => result.status === 'rejected')) {
			throw new TailscaleChildTerminationException();
		}
	}

	private async waitClosed(closed: Promise<void>, timeoutMs: number): Promise<boolean> {
		let timer: NodeJS.Timeout;
		try {
			return await Promise.race([
				closed.then(() => true),
				new Promise<boolean>((resolve) => {
					timer = setTimeout(() => resolve(false), timeoutMs);
				}),
			]);
		} finally {
			clearTimeout(timer);
		}
	}
}
