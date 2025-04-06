import type { StoreInjectionKey } from '../../../common';

import type { ICardsStoreActions, ICardsStoreState } from './cards.store.types';
import type { IDataSourcesStoreActions, IDataSourcesStoreState } from './dataSources.store.types';
import type { IPagesStoreActions, IPagesStoreState } from './pages.store.types';
import type { ITilesStoreActions, ITilesStoreState } from './tiles.store.types';

export const dataSourcesStoreKey: StoreInjectionKey<string, IDataSourcesStoreState, object, IDataSourcesStoreActions> =
	Symbol('FB-DashboardModuleDataSourcesStore');

export const tilesStoreKey: StoreInjectionKey<string, ITilesStoreState, object, ITilesStoreActions> = Symbol('FB-DashboardModuleTilesStore');

export const cardsStoreKey: StoreInjectionKey<string, ICardsStoreState, object, ICardsStoreActions> = Symbol('FB-DashboardModuleCardsStore');

export const pagesStoreKey: StoreInjectionKey<string, IPagesStoreState, object, IPagesStoreActions> = Symbol('FB-DashboardModulePagesStore');
