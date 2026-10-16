import { describe, expect, it, vi } from 'vitest';

import type { GroupProfile } from './useGroupCatalog';
import { useGroupCatalog } from './useGroupCatalog';

const client = vi.hoisted(() => ({ POST: vi.fn() }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const response = (profile: string) => ({
	data: {
		data: {
			profiles: [{ profile }],
			candidates: [{ channel: profile, eligible: false, reasons: ['cover_contract_type_incompatible'] }],
			diagnostics: [],
		},
	},
});
describe('metadata-only group profile catalog', () => {
	it('discards an older profile request completing after the new selection', async () => {
		let old!: (value: ReturnType<typeof response>) => void;
		client.POST.mockReset()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						old = resolve;
					})
			)
			.mockResolvedValueOnce(response('cover'));
		const catalog = useGroupCatalog();
		const previous = catalog.load({ profile: 'fan' as GroupProfile });
		await catalog.load({ profile: 'cover' as GroupProfile });
		old(response('fan'));
		await previous;
		expect(catalog.profiles.value[0].profile).toBe('cover');
		expect(catalog.catalog.value?.candidates[0].channel).toBe('cover');
		expect(catalog.catalog.value?.candidates[0].eligible).toBe(false);
		expect(catalog.pending.value).toBe(false);
	});
	it('clears eligibility during metadata refresh, preserving only profile definitions; exposes server drift diagnostics', async () => {
		client.POST.mockReset()
			.mockResolvedValueOnce(response('cover'))
			.mockResolvedValueOnce({ error: { message: 'Group profile changed; reload before repair' } });
		const catalog = useGroupCatalog();
		await catalog.load({ profile: 'cover' as GroupProfile });
		const refresh = catalog.load({ profile: 'cover' as GroupProfile, selected_channels: ['missing'], exposed_group: 'group' });
		expect(catalog.catalog.value).toBeNull();
		await refresh;
		expect(catalog.error.value).toContain('reload before repair');
		expect(catalog.profiles.value).toHaveLength(1);
		expect(catalog.catalog.value).toBeNull();
	});
});
