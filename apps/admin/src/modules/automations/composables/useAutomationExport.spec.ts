import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';

import { downloadTextFile, useAutomationExport } from './useAutomationExport';

const mockFlash = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const ID = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';

describe('useAutomationExport', () => {
	let exportYaml: Mock;
	let click: ReturnType<typeof vi.spyOn>;
	let createObjectURL: Mock;
	let revokeObjectURL: Mock;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		exportYaml = vi.fn().mockResolvedValue({ fileName: 'evening.yaml', contentType: 'application/yaml', content: 'version: 1\n' });

		(injectStoresManager as Mock).mockReturnValue({ getStore: () => ({ exportYaml, exporting: (id: string) => id === ID }) });

		createObjectURL = vi.fn(() => 'blob:yaml');
		revokeObjectURL = vi.fn();

		Object.assign(URL, { createObjectURL, revokeObjectURL });

		click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		click.mockRestore();
	});

	it('offers the automation as a file named after it and lets the object URL go afterwards', async () => {
		const { exportAutomation, exporting } = useAutomationExport();

		expect(exporting(ID)).toBe(true);
		expect(await exportAutomation(ID)).toBe(true);

		expect(exportYaml).toHaveBeenCalledWith({ id: ID });

		const blob = createObjectURL.mock.calls[0][0] as Blob;

		expect(blob.type).toBe('application/yaml');
		expect(await blob.text()).toBe('version: 1\n');

		const link = click.mock.instances[0] as unknown as HTMLAnchorElement;

		expect(link.download).toBe('evening.yaml');
		expect(link.href).toBe('blob:yaml');

		expect(revokeObjectURL).not.toHaveBeenCalled();

		vi.runAllTimers();

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:yaml');
	});

	it('says so when the automation could not be exported', async () => {
		exportYaml.mockRejectedValueOnce(new Error('offline'));

		const { exportAutomation } = useAutomationExport();

		expect(await exportAutomation(ID)).toBe(false);
		expect(click).not.toHaveBeenCalled();
		expect(mockFlash.error).toHaveBeenCalledWith('automations.transfer.messages.exportFailed');
	});

	it('reads the document to show it, or null when it can not be read', async () => {
		const { fetchYaml } = useAutomationExport();

		expect(await fetchYaml(ID)).toBe('version: 1\n');

		exportYaml.mockRejectedValueOnce(new Error('offline'));

		expect(await fetchYaml(ID)).toBeNull();
	});

	it('downloads any text', () => {
		downloadTextFile('a: 1', 'a.yaml', 'application/yaml');

		expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('a.yaml');
	});
});
