import { type Ref, computed, ref, toRaw, watch } from 'vue';
import { type LocationQueryRaw, useRoute, useRouter } from 'vue-router';

import { isEqual } from 'lodash';
import { z } from 'zod';

import { tryOnMounted } from '@vueuse/core';

import { injectStoresManager } from '../services/store';
import { listQueryStoreKey } from '../store/keys';
import { PaginationEntrySchema } from '../store/list.query.store.schemas';
import type { IPaginationEntry, ISortEntry } from '../store/list.query.store.types';
import { deepClone } from '../utils/objects.utils';

import type { IUseListQuery } from './types';

type AnyShape = z.ZodRawShape;

interface IUseListQueryProps<F extends z.ZodObject<AnyShape> | undefined> {
	key: string;
	filters?: {
		schema: NonNullable<F>;
		defaults: z.output<NonNullable<F>>;
	};
	sort?: {
		defaults: ISortEntry[];
	};
	pagination?: {
		defaults: IPaginationEntry;
	};
	syncQuery?: boolean;
	version?: number;
	debounceMs?: number;
	ttlMs?: number | null;
	includeInQuery?: (key: string) => boolean;
}

type OutputOrEmpty<T> = T extends z.ZodObject<AnyShape> ? z.output<T> : Record<string, never>;

const SORT_Q = 'sort'; // ?sort=field:asc (repeatable)

const PAG_Q_KEYS = Object.keys(PaginationEntrySchema.shape) as (keyof IPaginationEntry)[]; // ['page','perPage']

// HELPERS
//////////

const sanitizeSort = (arr: ISortEntry[] | undefined): ISortEntry[] => {
	if (!arr) {
		return [];
	}

	return arr.filter((e) => e && e.by && (e.dir === 'asc' || e.dir === 'desc'));
};

const sortToQuery = (arr: ISortEntry[] | undefined): string[] | undefined => {
	if (!arr?.length) {
		return undefined;
	}

	const tokens = arr
		.filter((e) => e && e.by)
		.filter((e) => e.dir === 'asc' || e.dir === 'desc') // drop null/invalid
		.map(({ by, dir }) => `${by}:${dir}`);

	return tokens.length ? tokens : undefined;
};

const sortFromQuery = (q: unknown, defaults: ISortEntry[]): ISortEntry[] | undefined => {
	// If the param is *truly absent*, caller should pass undefined and
	// we’ll return undefined => caller will fallback to defaults.
	if (q === undefined) {
		return undefined;
	}

	const arr = Array.isArray(q) ? q : q != null ? [q] : [];

	if (!arr.length) {
		return undefined;
	}

	// quick lookup of default dirs per column
	const defaultDirBy: Record<string, ISortEntry['dir']> = {};

	for (const { by, dir } of defaults) {
		defaultDirBy[by] = dir;
	}

	const out: ISortEntry[] = [];

	for (const token of arr) {
		const s = String(token);
		// supports "name:asc", "name:desc", and "name" (no dir)
		const [byRaw, dirRaw] = s.split(':');
		const by = byRaw?.trim();

		if (!by) {
			continue;
		}

		const d = (dirRaw ?? '').toLowerCase().trim();

		let dir: ISortEntry['dir'];

		if (d === 'asc' || d === 'desc') {
			dir = d;
		} else {
			// Fallback: if defaults include this column, use that dir
			// otherwise choose a global default (here: 'asc')
			dir = defaultDirBy[by] ?? 'asc';
		}

		out.push({ by, dir });
	}

	return out.length ? out : undefined;
};

const isEmptyValue = (v: unknown): boolean => {
	if (v == null) {
		return true;
	}

	if (Array.isArray(v)) {
		return v.length === 0;
	}

	return v === '';
};

const toQueryValue = (v: unknown): string | string[] | undefined => {
	if (v == null) {
		return undefined;
	}

	if (Array.isArray(v)) {
		return v.map(String);
	}

	if (v === '') {
		return undefined;
	}

	return String(v);
};

// COMPOSABLE
/////////////

export function useListQuery<F extends z.ZodObject<AnyShape> | undefined>({
	key,
	filters,
	sort,
	pagination,
	syncQuery = true,
	version = 1,
	debounceMs = 150,
	ttlMs = null,
	includeInQuery = () => true,
}: IUseListQueryProps<F>): IUseListQuery<OutputOrEmpty<F>> {
	type FF = OutputOrEmpty<NonNullable<F>>;

	type StoredShape<FF> = {
		filters?: FF;
		sort?: ISortEntry[];
		pagination?: IPaginationEntry;
	};

	const storesManager = injectStoresManager();

	const route = useRoute();
	const router = useRouter();

	const store = storesManager.getStore(listQueryStoreKey);

	const applySchema = <T extends z.ZodObject<AnyShape>>(schema: T, defaults: z.output<T>, obj: unknown): z.output<T> => {
		const parsed = schema.safeParse(obj);

		return parsed.success ? parsed.data : deepClone(defaults);
	};

	const filterKeys = filters ? (Object.keys(filters.schema.shape) as string[]) : [];

	const allKeys = new Set<string>([...filterKeys, ...PAG_Q_KEYS, SORT_Q]); // known URL keys we manage

	const routeHasRelevantKeys = computed<boolean>((): boolean => {
		return Object.keys(route.query).some((k) => allKeys.has(k));
	});

	const normalizedRouteQuery = computed<Record<string, unknown>>(() => {
		const out: Record<string, unknown> = {};

		// filters: coerce arrays where schema expects arrays
		if (filters) {
			const shape = filters.schema.shape as Record<string, z.ZodTypeAny>;

			for (const k of filterKeys) {
				const v = route.query[k];

				if (v === undefined) {
					continue;
				}

				const s = shape[k];

				if (s instanceof z.ZodArray) {
					out[k] = typeof v === 'string' ? [v] : Array.isArray(v) ? v : undefined;
				} else {
					out[k] = v;
				}
			}
		}

		// pagination
		for (const k of PAG_Q_KEYS) {
			const v = route.query[k as string];

			if (v !== undefined) {
				out[k as string] = v;
			}
		}

		// sort (special: lives under single key "sort", repeated)
		const sortQ = route.query[SORT_Q];
		const parsedSort = sortFromQuery(sortQ, sort?.defaults || []);

		if (parsedSort) {
			out[SORT_Q] = parsedSort;
		}

		return out;
	});

	const fromQueryFilters =
		syncQuery && routeHasRelevantKeys.value && filters
			? applySchema(filters.schema, filters.defaults, { ...filters.defaults, ...normalizedRouteQuery.value })
			: undefined;

	const fromQueryPagination =
		syncQuery && routeHasRelevantKeys.value && pagination
			? applySchema(PaginationEntrySchema, pagination.defaults, { ...pagination.defaults, ...normalizedRouteQuery.value })
			: undefined;

	const fromQuerySort =
		syncQuery && sort && route.query[SORT_Q] !== undefined ? (normalizedRouteQuery.value[SORT_Q] as ISortEntry[] | undefined) : undefined;

	// Load stored
	const stored = store.get<StoredShape<FF>>({ key, expectedVersion: version });

	const entry = store.entries[key];

	const isStoredValid = !!stored && (!ttlMs || Date.now() - (entry?.updatedAt ?? 0) <= ttlMs);

	// Defaults
	const sortDefaults: ISortEntry[] = sort?.defaults ?? [];

	const paginationDefaults: IPaginationEntry = pagination?.defaults ?? PaginationEntrySchema.parse({});

	// Initials
	const initialFilters: FF =
		(fromQueryFilters as FF | undefined) ??
		(isStoredValid && stored?.filters ? deepClone(stored.filters as FF) : undefined) ??
		(filters ? deepClone(filters.defaults as FF) : ({} as FF));

	const initialPagination: IPaginationEntry =
		fromQueryPagination ?? (isStoredValid && stored?.pagination ? deepClone(stored.pagination) : undefined) ?? deepClone(paginationDefaults);

	const storedSort = isStoredValid && stored?.sort ? sanitizeSort(deepClone(stored.sort)) : undefined;
	const querySort = sanitizeSort(fromQuerySort ? deepClone(fromQuerySort) : undefined);
	const initialSort: ISortEntry[] = querySort.length ? querySort : typeof storedSort !== 'undefined' ? storedSort : deepClone(sortDefaults);

	// State
	const filtersRef = ref<FF>(initialFilters) as Ref<FF>;

	const paginationRef = ref<IPaginationEntry>(initialPagination);

	const sortRef = ref<ISortEntry[]>(initialSort);

	// Reset page to default when non-pagination sort-independent filters change
	if (filters) {
		const ignore = new Set<string>([...PAG_Q_KEYS.map(String), SORT_Q]);

		watch(
			() =>
				Object.keys(filters.schema.shape)
					.filter((k) => !ignore.has(k))
					.map((k) => deepClone(toRaw(filtersRef.value[k as keyof FF]))),
			(next, prev) => {
				const changed = !isEqual(next, prev);

				if (changed && paginationRef.value.page !== paginationDefaults.page) {
					paginationRef.value = { ...paginationRef.value, page: paginationDefaults.page };
				}
			},
			{ deep: true }
		);
	}

	// Persist (debounced)
	let tF: number | undefined, tS: number | undefined, tP: number | undefined;

	watch(
		filtersRef,
		(val) => {
			window.clearTimeout(tF);

			tF = window.setTimeout(() => {
				store.patch({ key, data: { filters: val }, version });
			}, debounceMs);
		},
		{ deep: true }
	);

	watch(
		sortRef,
		(val) => {
			window.clearTimeout(tS);

			tS = window.setTimeout(() => {
				const cleaned = sanitizeSort(val);

				// store empty array if nothing to sort — reading phase falls back to defaults
				store.patch({ key, data: { sort: cleaned }, version });
			}, debounceMs);
		},
		{ deep: true }
	);

	watch(
		paginationRef,
		(val) => {
			window.clearTimeout(tP);

			tP = window.setTimeout(() => {
				store.patch({ key, data: { pagination: val }, version });
			}, debounceMs);
		},
		{ deep: true }
	);

	// URL sync (debounced)
	const replaceQuery = (next: LocationQueryRaw) => {
		router.replace({ query: next }).catch(() => void 0);
	};

	let qF: number | undefined, qS: number | undefined, qP: number | undefined;

	// Sync filters (per-key)
	if (syncQuery && filters) {
		watch(
			filtersRef,
			(val) => {
				if (qF) {
					window.clearTimeout(qF);
				}

				qF = window.setTimeout(() => {
					const next: LocationQueryRaw = { ...route.query };

					for (const k of filterKeys) {
						if (!includeInQuery(k)) {
							delete next[k];

							continue;
						}

						const qv = toQueryValue(val[k as keyof FF]);
						const dv = toQueryValue(filters.defaults[k as keyof typeof filters.defaults]);

						if (isEmptyValue(qv) || isEqual(qv, dv)) {
							delete next[k];

							continue;
						}

						next[k] = qv!;
					}

					// prune unknowns
					for (const existing of Object.keys(next)) {
						if (!allKeys.has(existing)) {
							delete next[existing];
						}
					}

					replaceQuery(next);
				}, debounceMs);
			},
			{ deep: true }
		);
	}

	// Sync sort (?sort=field:dir)
	if (syncQuery) {
		watch(
			sortRef,
			(val) => {
				if (qS) {
					window.clearTimeout(qS);
				}

				qS = window.setTimeout(() => {
					const next: LocationQueryRaw = { ...route.query };

					const qv = sortToQuery(val);
					const dv = sortToQuery(sortDefaults);

					if (!qv || isEqual(qv, dv)) {
						delete next[SORT_Q];
					} else {
						next[SORT_Q] = qv;
					}

					for (const existing of Object.keys(next)) {
						if (!allKeys.has(existing)) delete next[existing];
					}

					replaceQuery(next);
				}, debounceMs);
			},
			{ deep: true }
		);
	}

	// Sync pagination (page, perPage)
	if (syncQuery) {
		watch(
			paginationRef,
			(val) => {
				if (qP) {
					window.clearTimeout(qP);
				}

				qP = window.setTimeout(() => {
					const next: LocationQueryRaw = { ...route.query };

					for (const k of PAG_Q_KEYS) {
						if (!includeInQuery(k)) {
							delete next[k];

							continue;
						}

						const qv = toQueryValue(val[k]);
						const dv = toQueryValue(paginationDefaults[k]);

						if (isEmptyValue(qv) || isEqual(qv, dv)) {
							delete next[k];

							continue;
						}

						next[k] = qv!;
					}

					for (const existing of Object.keys(next)) {
						if (!allKeys.has(existing)) delete next[existing];
					}

					replaceQuery(next);
				}, debounceMs);
			},
			{ deep: true }
		);
	}

	// Hydrate URL once from store if no relevant keys present
	tryOnMounted(() => {
		if (!syncQuery || !stored || !isStoredValid || routeHasRelevantKeys.value) {
			return;
		}

		const next: LocationQueryRaw = {};

		// filters
		if (filters && stored.filters) {
			for (const k of filterKeys) {
				if (!includeInQuery(k)) {
					continue;
				}

				const qv = toQueryValue(stored.filters[k as keyof FF]);
				const dv = toQueryValue(filters.defaults[k as keyof typeof filters.defaults]);

				if (isEmptyValue(qv) || isEqual(qv, dv)) {
					continue;
				}

				next[k] = qv!;
			}
		}

		// sort
		if (stored.sort) {
			const qv = sortToQuery(sanitizeSort(stored.sort));
			const dv = sortToQuery(sortDefaults);

			if (qv && !isEqual(qv, dv)) {
				next[SORT_Q] = qv;
			}
		}

		// pagination
		if (stored.pagination) {
			for (const k of PAG_Q_KEYS) {
				if (!includeInQuery(k)) {
					continue;
				}

				const qv = toQueryValue(stored.pagination[k]);
				const dv = toQueryValue(paginationDefaults[k]);

				if (isEmptyValue(qv) || isEqual(qv, dv)) {
					continue;
				}

				next[k] = qv!;
			}
		}

		if (Object.keys(next).length) {
			replaceQuery(next);
		}
	});

	const reset = () => {
		if (filters?.defaults) {
			filtersRef.value = deepClone(filters.defaults as FF);
		}
	};

	return {
		filters: filtersRef,
		sort: sortRef,
		pagination: paginationRef,
		reset,
	};
}
