import { onUnmounted, ref } from 'vue';

export interface IUseOAuthPopup {
	isAuthorizing: ReturnType<typeof ref<boolean>>;
	authError: ReturnType<typeof ref<string | null>>;
	startOAuth(authorizeEndpoint: string, clientId: string): Promise<boolean>;
}

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;
const POLL_INTERVAL_MS = 2000;
const POLL_INITIAL_DELAY_MS = 5000;
const STORAGE_KEY = 'oauth-callback';

export const useOAuthPopup = (provider: string): IUseOAuthPopup => {
	const isAuthorizing = ref<boolean>(false);
	const authError = ref<string | null>(null);

	let popupWindow: Window | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let delayTimer: ReturnType<typeof setTimeout> | null = null;
	let messageHandler: ((event: MessageEvent) => void) | null = null;
	let storageHandler: ((event: StorageEvent) => void) | null = null;

	const cleanup = (): void => {
		if (delayTimer) {
			clearTimeout(delayTimer);
			delayTimer = null;
		}

		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}

		if (messageHandler) {
			window.removeEventListener('message', messageHandler);
			messageHandler = null;
		}

		if (storageHandler) {
			window.removeEventListener('storage', storageHandler);
			storageHandler = null;
		}

		popupWindow = null;
	};

	const handleOAuthResult = (
		data: { type?: string; provider?: string; success?: boolean; error?: string | null },
		resolve: (value: boolean) => void,
	): boolean => {
		if (data?.type !== 'oauth-callback' || data?.provider !== provider) {
			return false;
		}

		cleanup();

		if (data.success) {
			isAuthorizing.value = false;

			resolve(true);
		} else {
			authError.value = data.error ?? 'Authorization failed';
			isAuthorizing.value = false;

			resolve(false);
		}

		return true;
	};

	const startOAuth = async (authorizeEndpoint: string, clientId: string): Promise<boolean> => {
		isAuthorizing.value = true;
		authError.value = null;

		cleanup();

		// Clear any stale storage data
		localStorage.removeItem(STORAGE_KEY);

		try {
			const separator = authorizeEndpoint.includes('?') ? '&' : '?';
			const origin = encodeURIComponent(window.location.origin);
			const url = `${authorizeEndpoint}${separator}client_id=${encodeURIComponent(clientId)}&origin=${origin}`;

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to start OAuth flow: ${response.status}`);
			}

			const result = (await response.json()) as { data: { authorize_url: string } };
			const authorizeUrl = result.data.authorize_url;

			const left = Math.round((window.screen.width - POPUP_WIDTH) / 2);
			const top = Math.round((window.screen.height - POPUP_HEIGHT) / 2);

			popupWindow = window.open(
				authorizeUrl,
				`oauth_${provider}`,
				`width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`
			);

			if (!popupWindow) {
				throw new Error('Popup was blocked by the browser. Please allow popups for this site.');
			}

			return new Promise<boolean>((resolve) => {
				// Listen for postMessage (works when window.opener is preserved)
				messageHandler = (event: MessageEvent): void => {
					const data = event.data as { type?: string; provider?: string; success?: boolean; error?: string | null };

					handleOAuthResult(data, resolve);
				};

				// Listen for localStorage changes (works when window.opener is lost due to cross-origin HTTPS→HTTP)
				storageHandler = (event: StorageEvent): void => {
					if (event.key !== STORAGE_KEY || !event.newValue) {
						return;
					}

					try {
						const data = JSON.parse(event.newValue) as {
							type?: string;
							provider?: string;
							success?: boolean;
							error?: string | null;
						};

						if (handleOAuthResult(data, resolve)) {
							localStorage.removeItem(STORAGE_KEY);
						}
					} catch {
						// Ignore malformed data
					}
				};

				window.addEventListener('message', messageHandler);
				window.addEventListener('storage', storageHandler);

				// Delay polling to give the popup time to complete the OAuth flow
				delayTimer = setTimeout(() => {
					delayTimer = null;

					pollTimer = setInterval(() => {
						if (popupWindow?.closed) {
							cleanup();

							if (isAuthorizing.value) {
								isAuthorizing.value = false;
								authError.value = 'Authorization was cancelled';

								resolve(false);
							}
						}
					}, POLL_INTERVAL_MS);
				}, POLL_INITIAL_DELAY_MS);
			});
		} catch (error) {
			authError.value = error instanceof Error ? error.message : 'Failed to start authorization';
			isAuthorizing.value = false;

			return false;
		}
	};

	onUnmounted(() => {
		const popup = popupWindow;

		cleanup();

		if (popup && !popup.closed) {
			popup.close();
		}
	});

	return {
		isAuthorizing,
		authError,
		startOAuth,
	};
};
