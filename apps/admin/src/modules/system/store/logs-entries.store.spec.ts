import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../openapi.constants';

import { MAX_LIVE_LOG_ENTRIES, useLogsEntries } from './logs-entries.store';

const backendClient = {
	GET: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

// Crockford's base32 alphabet (excludes I, L, O, U), matching the ULID charset the store's schema expects.
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const encodeBase32 = (value: number): string => {
	let encoded = '';
	let remaining = value;

	do {
		encoded = ULID_ALPHABET[remaining % 32] + encoded;
		remaining = Math.floor(remaining / 32);
	} while (remaining > 0);

	return encoded;
};

// A deterministic, distinct, valid-looking ULID per index so entries are cheap to generate in bulk.
const makeLogEntryId = (index: number): string => encodeBase32(index).padStart(26, '0');

const BASE_TS = Date.parse('2026-01-01T00:00:00.000Z');

// Later index => later timestamp, so "newest by ts" and "highest index" are interchangeable in assertions.
const makeLogEntryRes = (index: number) => ({
	id: makeLogEntryId(index),
	ts: new Date(BASE_TS + index * 1000).toISOString(),
	ingested_at: new Date(BASE_TS + index * 1000).toISOString(),
	source: SystemModuleLogEntrySource.backend,
	level: 6,
	type: SystemModuleLogEntryType.info,
	message: `entry-${index}`,
	user: {},
	context: {},
});

const makeLogsResponse = (fromIndex: number, toIndex: number, metadata: { has_more: boolean; next_cursor?: string }) => ({
	data: {
		data: Array.from({ length: toIndex - fromIndex + 1 }, (_, i) => makeLogEntryRes(fromIndex + i)),
		metadata,
	},
	error: undefined,
	response: { status: 200 },
});

describe('LogsEntries Store', () => {
	let store: ReturnType<typeof useLogsEntries>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useLogsEntries();

		vi.clearAllMocks();
	});

	it('caps retained entries at MAX_LIVE_LOG_ENTRIES and keeps the newest by ts when appending without a cursor', async () => {
		(backendClient.GET as Mock)
			.mockResolvedValueOnce(makeLogsResponse(0, 599, { has_more: true, next_cursor: makeLogEntryId(599) }))
			.mockResolvedValueOnce(makeLogsResponse(600, 1004, { has_more: false }));

		await store.fetch({ append: true });
		await store.fetch({ append: true });

		expect(Object.keys(store.data).length).toBe(MAX_LIVE_LOG_ENTRIES);

		// 1005 distinct entries appended over the cap by 5: the 5 oldest (indices 0-4) are pruned,
		// the newest 1000 (indices 5-1004) survive.
		expect(store.findById(makeLogEntryId(0))).toBeNull();
		expect(store.findById(makeLogEntryId(4))).toBeNull();
		expect(store.findById(makeLogEntryId(5))).not.toBeNull();
		expect(store.findById(makeLogEntryId(1004))).not.toBeNull();
	});

	// Real afterId pagination is the user scrolling further back into history: the paginated page
	// is always OLDER than whatever's already in the store, never newer.
	it('never prunes when paging in older entries (afterId set)', async () => {
		(backendClient.GET as Mock).mockResolvedValueOnce(makeLogsResponse(10, 1009, { has_more: true, next_cursor: makeLogEntryId(10) }));

		await store.fetch({ append: true });

		expect(Object.keys(store.data).length).toBe(MAX_LIVE_LOG_ENTRIES);

		(backendClient.GET as Mock).mockResolvedValueOnce(makeLogsResponse(0, 9, { has_more: false }));

		await store.fetch({ afterId: makeLogEntryId(10), append: true });

		// The paginated page (indices 0-9) is older than everything already in the store
		// (indices 10-1009). Appending it pushes the map over the cap, but afterId exempts
		// this fetch from pruning.
		expect(Object.keys(store.data).length).toBe(MAX_LIVE_LOG_ENTRIES + 10);
		expect(store.findById(makeLogEntryId(0))).not.toBeNull();
	});

	it('prunes previously paged-in older entries on the next live append once the cap is exceeded', async () => {
		(backendClient.GET as Mock).mockResolvedValueOnce(makeLogsResponse(10, 1009, { has_more: true, next_cursor: makeLogEntryId(10) }));

		await store.fetch({ append: true });

		(backendClient.GET as Mock).mockResolvedValueOnce(makeLogsResponse(0, 9, { has_more: false }));

		await store.fetch({ afterId: makeLogEntryId(10), append: true });

		expect(Object.keys(store.data).length).toBe(MAX_LIVE_LOG_ENTRIES + 10);
		expect(store.findById(makeLogEntryId(0))).not.toBeNull();

		// The live poller ticks again (no afterId). This newest page doesn't overlap what's
		// already in the store, so the merge is unambiguously over the cap by 30, and the 30
		// oldest entries -- indices 0-29, which fully contain the page paged in above -- are pruned.
		(backendClient.GET as Mock).mockResolvedValueOnce(makeLogsResponse(1010, 1029, { has_more: false }));

		await store.fetch({ append: true });

		expect(Object.keys(store.data).length).toBe(MAX_LIVE_LOG_ENTRIES);

		// The entire paginated-in older page is gone.
		expect(store.findById(makeLogEntryId(0))).toBeNull();
		expect(store.findById(makeLogEntryId(9))).toBeNull();

		// Exact cutoff: index 29 is dropped, index 30 is the oldest survivor.
		expect(store.findById(makeLogEntryId(29))).toBeNull();
		expect(store.findById(makeLogEntryId(30))).not.toBeNull();

		// The newest entries from this live tick are retained.
		expect(store.findById(makeLogEntryId(1029))).not.toBeNull();
	});
});
