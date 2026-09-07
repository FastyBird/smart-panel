import { afterEach, describe, expect, it, vi } from 'vitest';

import { useClipboard } from './useClipboard';

describe('useClipboard', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('uses the Clipboard API and resolves true in a secure context, without touching the execCommand fallback', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const execCommand = vi.fn();

		vi.stubGlobal('isSecureContext', true);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});
		document.execCommand = execCommand;

		const { copy } = useClipboard();
		const result = await copy('https://panel.example.com');

		expect(writeText).toHaveBeenCalledWith('https://panel.example.com');
		expect(execCommand).not.toHaveBeenCalled();
		expect(result).toBe(true);
	});

	it('falls back to execCommand("copy") when the Clipboard API rejects, and still resolves true', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));

		vi.stubGlobal('isSecureContext', true);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		const execCommand = vi.fn().mockReturnValue(true);
		document.execCommand = execCommand;

		const { copy } = useClipboard();
		const result = await copy('https://panel.example.com');

		expect(writeText).toHaveBeenCalledWith('https://panel.example.com');
		expect(execCommand).toHaveBeenCalledWith('copy');
		expect(result).toBe(true);
	});

	it('falls back to execCommand("copy") outside a secure context and resolves true', async () => {
		vi.stubGlobal('isSecureContext', false);
		Object.defineProperty(navigator, 'clipboard', {
			value: undefined,
			configurable: true,
		});

		const execCommand = vi.fn().mockReturnValue(true);
		document.execCommand = execCommand;

		const appendSpy = vi.spyOn(document.body, 'appendChild');
		const removeSpy = vi.spyOn(document.body, 'removeChild');

		const { copy } = useClipboard();
		const result = await copy('http://192.168.1.5');

		expect(execCommand).toHaveBeenCalledWith('copy');
		expect(result).toBe(true);
		expect(appendSpy).toHaveBeenCalled();
		expect(removeSpy).toHaveBeenCalled();
	});

	it('resolves false, without throwing, when both the Clipboard API and the execCommand fallback fail', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));

		vi.stubGlobal('isSecureContext', true);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		document.execCommand = vi.fn().mockImplementation(() => {
			throw new Error('not supported');
		});

		const { copy } = useClipboard();

		await expect(copy('https://panel.example.com')).resolves.toBe(false);
	});

	it('resolves false, without throwing, when the execCommand fallback throws outside a secure context', async () => {
		vi.stubGlobal('isSecureContext', false);
		Object.defineProperty(navigator, 'clipboard', {
			value: undefined,
			configurable: true,
		});

		document.execCommand = vi.fn().mockImplementation(() => {
			throw new Error('not supported');
		});

		const { copy } = useClipboard();

		await expect(copy('http://192.168.1.5')).resolves.toBe(false);
	});

	it('resolves false when the execCommand fallback runs but reports no selection was copied', async () => {
		vi.stubGlobal('isSecureContext', false);
		Object.defineProperty(navigator, 'clipboard', {
			value: undefined,
			configurable: true,
		});

		document.execCommand = vi.fn().mockReturnValue(false);

		const { copy } = useClipboard();

		await expect(copy('http://192.168.1.5')).resolves.toBe(false);
	});
});
