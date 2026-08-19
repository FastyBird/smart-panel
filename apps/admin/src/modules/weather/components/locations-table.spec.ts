import { type ComponentPublicInstance } from 'vue';

import { ElTableColumn } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import type { IWeatherLocation } from '../store/locations.store.types';

import type { ILocationsTableProps } from './locations-table.types';
import LocationsTable from './locations-table.vue';

type LocationsTableInstance = ComponentPublicInstance<ILocationsTableProps>;

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		// The selection column is behind `v-if="isMDDevice"`, and jsdom reports a
		// narrow viewport, so without this the column under test never renders.
		useBreakpoints: () => ({ isMDDevice: true }),
	};
});

describe('LocationsTable', (): void => {
	let wrapper: VueWrapper<LocationsTableInstance>;

	const locationsMock: IWeatherLocation[] = [
		{
			id: 'primary-location',
			draft: false,
			type: 'weather-open-meteo',
			name: 'Prague',
			order: 0,
			createdAt: new Date(),
			updatedAt: null,
		} as IWeatherLocation,
		{
			id: 'other-location',
			draft: false,
			type: 'weather-open-meteo',
			name: 'Brno',
			order: 1,
			createdAt: new Date(),
			updatedAt: null,
		} as IWeatherLocation,
	];

	const createWrapper = (props: Partial<ILocationsTableProps> = {}): void => {
		wrapper = mount(LocationsTable, {
			props: {
				items: locationsMock,
				totalRows: locationsMock.length,
				loading: false,
				filtersActive: false,
				sortBy: 'name',
				sortDir: 'ascending',
				tableHeight: 400,
				filters: { search: undefined, types: [], primary: 'all' },
				primaryLocationId: 'primary-location',
				weatherByLocation: {},
				temperatureUnit: 'celsius',
				weatherFetchCompleted: true,
				...props,
			} as ILocationsTableProps,
			global: {
				// These render plugin metadata and live weather from stores, which the
				// selection predicate has nothing to do with.
				stubs: {
					LocationsTableColumnPlugin: true,
					LocationsTableColumnWeather: true,
				},
			},
		});
	};

	const selectablePredicate = (): ((row: IWeatherLocation) => boolean) => {
		const column = wrapper.findAllComponents(ElTableColumn).find((c) => c.props('type') === 'selection');

		return column!.props('selectable') as (row: IWeatherLocation) => boolean;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	// The backend refuses to delete the primary location and says to reassign it
	// first, so offering it for selection only produces a failure the operator can
	// do nothing about - and "select all" would always report one.
	describe('protected rows', (): void => {
		it('does not let the primary location be selected', (): void => {
			createWrapper();

			expect(selectablePredicate()(locationsMock[0]!)).toBe(false);
		});

		it('lets any other location be selected', (): void => {
			createWrapper();

			expect(selectablePredicate()(locationsMock[1]!)).toBe(true);
		});

		it('selects normally when no primary location is configured', (): void => {
			createWrapper({ primaryLocationId: null });

			expect(selectablePredicate()(locationsMock[0]!)).toBe(true);
		});
	});
});
