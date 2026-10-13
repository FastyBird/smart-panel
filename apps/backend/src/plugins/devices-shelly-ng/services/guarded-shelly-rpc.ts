import { RpcParams, WebSocketRpcHandler, WebSocketRpcHandlerFactory } from 'shellies-ds9';

const sendGuard = Symbol('shelly-internal-send-guard');
type GuardedParams = RpcParams & { [sendGuard]?: () => boolean };

/** Per-request authority survives connect waits and the pinned SDK's digest authentication retry. */
export class GuardedShellyRpcHandler extends WebSocketRpcHandler {
	private activeGuard: (() => boolean) | undefined;

	withSendGuard<T>(isCurrent: () => boolean, invoke: () => T): T {
		const previous = this.activeGuard;
		this.activeGuard = isCurrent;
		try {
			return invoke();
		} finally {
			this.activeGuard = previous;
		}
	}

	override request<T>(method: string, params?: RpcParams): PromiseLike<T> {
		if (!this.activeGuard) return super.request<T>(method, params);
		const guarded: GuardedParams = { ...params };
		Object.defineProperty(guarded, sendGuard, { value: this.activeGuard });
		return super.request<T>(method, guarded);
	}

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
