import type { IDataSource, ITile } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';

import type { IPageConfigureTilePlace } from './page-configure.types';

export interface ICardsInspectorProps {
	/** The selected tile's place in the editor and the tile, or null */
	place: IPageConfigureTilePlace | null;
	tile: ITile | null;
	/** The selected card, or with a tile selected the card holding it; null with nothing selected */
	card: ICard | null;
	/** The selected card's tile count, as the editor shows them */
	cardTileCount?: number;
	/** The grid a card gets from the display when it sets none of its own */
	gridLayout: { rows: number; cols: number } | null;
	dataSources: IDataSource[];
	dataSourcesLoading: boolean;
	/** The layout is being saved: removals wait for it */
	disabled?: boolean;
}
