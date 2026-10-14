import { RpcParams, WebSocketRpcHandler, WebSocketRpcHandlerFactory } from 'shellies-ds9';

const sendGuard = Symbol('shelly-internal-send-guard');
type GuardedParams = RpcParams & { [sendGuard]?: () => boolean };

/** Per-request authority survives connect waits and the pinned SDK's digest authentication retry. */
export class GuardedShellyRpcHandler extends WebSocketRpcHandler {
	private activeGuard: (() => boolean) | undefined;

	/** Capture authority for requests created by invoke, restoring the previous scope even when invoke throws. */
	withSendGuard<T>(isCurrent: () => boolean, invoke: () => T): T {
		const previous = this.activeGuard;
		this.activeGuard = isCurrent;
		try {
			return invoke();
		} finally {
			this.activeGuard = previous;
		}
	}

	/**
	 * Bind every SDK request to its pending lifetime, deadline and optional captured authority.
	 * Settlement disables later sends even if the SDK is still waiting for a connection or authentication retry.
	 */
	override request<T>(method: string, params?: RpcParams): PromiseLike<T> {
		// The SDK's client timeout does not cancel handleRequest's asynchronous connect wait.
		// Fence every request at settlement, including ordinary pre-claim switch commands.
		const authority = this.activeGuard;
		let pending = true;
		const timeoutMs = this.options.requestTimeout * 1000;
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new Error('Invalid Shelly timeout'));
		const expiresAt = Date.now() + timeoutMs;
		const guarded: GuardedParams = { ...params };
		Object.defineProperty(guarded, sendGuard, {
			value: () => pending && Date.now() < expiresAt && (authority?.() ?? true),
		});
		let timer: ReturnType<typeof setTimeout>;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Shelly request deadline expired')), timeoutMs);
		});
		return Promise.race([Promise.resolve(super.request<T>(method, guarded)), timeout]).finally(() => {
			pending = false;
			clearTimeout(timer);
		});
	}

	/** Reject expired authority at the SDK send boundary, including digest authentication resends. */
	protected override sendRequest(payload: RpcParams): Promise<void> {
		const guard = (payload.params as GuardedParams | undefined)?.[sendGuard];
		if (guard && !guard()) return Promise.reject(new Error('Shelly request authority expired before send'));
		return super.sendRequest(payload);
	}
}

/** Replace this factory instance's public creation method, without touching vendor files or prototypes. */
export function installGuardedShellyRpcFactory(factory: WebSocketRpcHandlerFactory): void {
	factory.create = (hostname, options) =>
		new GuardedShellyRpcHandler(hostname, { ...factory.defaultOptions, ...options });
}
