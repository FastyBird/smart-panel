import type { StoreInjectionKey } from '../../../common';

import type { IDataSourcesStoreActions, IDataSourcesStoreState } from './dataSources.store.types';
import type { IPagesStoreActions, IPagesStoreState } from './pages.store.types';
import type { ITilesStoreActions, ITilesStoreState } from './tiles.store.types';

export const dataSourcesStoreKey: StoreInjectionKey<string, IDataSourcesStoreState, object, IDataSourcesStoreActions> = Symbol(
	'FB-Module-Dashboard-DataSourcesStore'
);

export const tilesStoreKey: StoreInjectionKey<string, ITilesStoreState, object, ITilesStoreActions> = Symbol('FB-Module-Dashboard-TilesStore');

export const pagesStoreKey: StoreInjectionKey<string, IPagesStoreState, object, IPagesStoreActions> = Symbol('FB-Module-Dashboard-PagesStore');
