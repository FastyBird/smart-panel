import { describe, expect, it, vi } from 'vitest';

import type { components } from '../../../openapi';

import { useLightGroupAuthoring } from './useLightGroupAuthoring';

const client = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const draft = (ids: string[]) => ({ members: ids.map((id) => ({ source_channel: id })) });
const response = (revision: number) => ({
	data: { data: { graph_revision: revision, common_capabilities: [], unavailable_capabilities: [], members: [] } },
});
describe('light group preview admission', () => {
	it('keeps only the newest preview when older metadata requests finish last', async () => {
		let first!: (value: ReturnType<typeof response>) => void;
		let second!: (value: ReturnType<typeof response>) => void;
		client.POST.mockReset()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						first = resolve;
					})
			)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						second = resolve;
					})
			);
		const authoring = useLightGroupAuthoring();
		const previous = authoring.previewDraft(draft(['a', 'b']));
		const latest = authoring.previewDraft(draft(['a', 'c']));
		second(response(2));
		await latest;
		first(response(1));
		await previous;
		expect(authoring.preview.value?.graph_revision).toBe(2);
		expect(authoring.pending.value).toBe(false);
	});
	it('refuses saving changed members until a matching preview has been admitted', async () => {
		client.POST.mockReset().mockResolvedValue(response(3));
		const authoring = useLightGroupAuthoring();
		await authoring.previewDraft(draft(['a', 'b']));
		await expect(authoring.create({ ...draft(['a', 'c']), device: { name: 'Group' } })).rejects.toThrow('previewRequired');
		expect(client.POST).toHaveBeenCalledTimes(1);
	});
	it('requires a new preview when only the profile changes', async () => {
		client.POST.mockReset().mockResolvedValue(response(3));
		const authoring = useLightGroupAuthoring();
		await authoring.previewDraft(draft(['a', 'b']));
		await expect(
			authoring.create({
				...draft(['a', 'b']),
				profile: 'fan' as components['schemas']['DevicesVirtualPluginCreateLightGroupDraft']['profile'],
				device: { name: 'Fan' },
			})
		).rejects.toThrow('previewRequired');
		expect(client.POST).toHaveBeenCalledTimes(1);
	});

	it('exposes server revision refusal without retrying or creating a second request', async () => {
		client.POST.mockReset()
			.mockResolvedValueOnce(response(4))
			.mockResolvedValueOnce({ error: { message: 'Graph revision changed' }, response: { status: 422 } });
		const authoring = useLightGroupAuthoring();
		await authoring.previewDraft(draft(['a', 'b']));
		expect(await authoring.create({ ...draft(['a', 'b']), device: { name: 'Group' } })).toBeNull();
		expect(authoring.repairConflict.value).toBe(true);
		expect(client.POST).toHaveBeenCalledTimes(2);
	});
});
