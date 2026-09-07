import type { IUseClipboard } from './types';

export const useClipboard = (): IUseClipboard => {
	// `navigator.clipboard` only exists in a secure context (HTTPS or localhost) - accessing the admin
	// over plain HTTP on the LAN (e.g. `http://<lan-ip>`) leaves it undefined, so this falls back to the
	// legacy `execCommand('copy')` approach via an off-screen textarea instead of throwing.
	const copyViaClipboardApi = async (text: string): Promise<boolean> => {
		try {
			await navigator.clipboard.writeText(text);

			return true;
		} catch {
			return false;
		}
	};

	const copyViaExecCommand = (text: string): boolean => {
		const textarea = document.createElement('textarea');

		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';

		document.body.appendChild(textarea);
		textarea.select();

		try {
			return document.execCommand('copy');
		} catch {
			return false;
		} finally {
			document.body.removeChild(textarea);
		}
	};

	const copy = async (text: string): Promise<boolean> => {
		if (window.isSecureContext && navigator.clipboard) {
			const copiedViaClipboardApi = await copyViaClipboardApi(text);

			if (copiedViaClipboardApi) {
				return true;
			}

			// The Clipboard API rejected (e.g. permission denied) - fall through to the legacy
			// approach below instead of giving up after a single failed attempt.
		}

		return copyViaExecCommand(text);
	};

	return {
		copy,
	};
};
