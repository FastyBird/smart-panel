import type { FormResultType, ITile } from '../../../modules/dashboard';
import type { IDisplay } from '../../../modules/displays';
import type { ICard } from '../store/cards.store.types';
import type { ICardsPage } from '../store/pages.store.types';

export interface IPageConfigureProps {
	page: ICardsPage;
	cards: ICard[];
	gridLayout: { rows: number; cols: number } | null;
	gridCardStyle: Record<string, string>;
	/** The display the page is laid out for: the tiles are drawn in its theme */
	selectedDisplay: IDisplay | null;
	selectedTileId?: ITile['id'] | null;
	selectedCardId?: ICard['id'] | null;
	remotePageSubmit?: boolean;
	remotePageResult?: FormResultType;
	remotePageChanged?: boolean;
}

/** Where a tile sits in the editor now, saved or not: its card and its cell */
export interface IPageConfigureTilePlace {
	id: ITile['id'];
	cardId: ICard['id'];
	row: number;
	col: number;
	rowSpan: number;
	colSpan: number;
}

export interface IPageConfigureExpose {
	removeTile: (id: ITile['id']) => void;
}
