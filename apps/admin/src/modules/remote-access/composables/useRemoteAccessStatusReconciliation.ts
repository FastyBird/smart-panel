import { type EffectScope, type Ref, effectScope, onScopeDispose, watch } from 'vue';

interface StatusSnapshot {
	epoch?: string;
	revision?: number;
	state: string;
}

interface StatusSource<T extends StatusSnapshot> {
	data: Ref<T | null>;
	semaphore: Ref<{ getting: boolean }>;
}

interface ReconciliationSession {
	scope: EffectScope;
	subscribers: number;
}

const sessions = new WeakMap<object, ReconciliationSession>();

/** Share private-status reconciliation between all mounted consumers of one provider store. */
export const useRemoteAccessStatusReconciliation = <T extends StatusSnapshot>(
	store: { get: () => Promise<unknown> },
	source: StatusSource<T>,
	hasOperation: () => boolean = () => false
): void => {
	let session = sessions.get(store);

	if (!session) {
		const scope = effectScope(true);
		session = { scope, subscribers: 0 };
		sessions.set(store, session);

		scope.run(() => {
			let lastReconciliation = Date.now();
			let reading = false;
			const reconcile = async (): Promise<void> => {
				if (reading || source.semaphore.value.getting) return;
				reading = true;
				lastReconciliation = Date.now();
				try {
					await store.get();
				} catch {
					// Retry on the next bounded tick, including when the initial read failed.
				} finally {
					reading = false;
				}
			};

			// GET commits happen while `getting` is true, so they cannot trigger a read/event loop.
			watch(
				[() => source.data.value?.epoch, () => source.data.value?.revision],
				() => {
					void reconcile();
				},
				{ flush: 'sync' }
			);
			const timer = setInterval(() => {
				const progressing = hasOperation() || ['connecting', 'pending-auth', 'pending-approval'].includes(source.data.value?.state ?? '');
				if (progressing || Date.now() - lastReconciliation >= 30_000) void reconcile();
			}, 5_000);
			onScopeDispose(() => clearInterval(timer));
		});
	}

	const subscription = session;
	subscription.subscribers++;
	onScopeDispose(() => {
		if (--subscription.subscribers === 0) {
			subscription.scope.stop();
			sessions.delete(store);
		}
	});
};
