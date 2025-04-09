import type { StoreInjectionKey } from '../../../common';

import type { ICardsStoreActions, ICardsStoreState } from './cards.store.types';

export const cardsStoreKey: StoreInjectionKey<string, ICardsStoreState, object, ICardsStoreActions> = Symbol(
	'FB-Plugin-DashboardCardsPageCardsStore'
);
