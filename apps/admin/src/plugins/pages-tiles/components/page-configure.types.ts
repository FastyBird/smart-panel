import type { FormResultType, ITile } from '../../../modules/dashboard';
import type { ITilesPage } from '../store/pages.store.types';

export interface IPageConfigureProps {
	page: ITilesPage;
	gridLayout: { rows: number; cols: number } | null;
	/** The target display uses its dark theme: tiles are drawn in its dark tokens */
	dark?: boolean;
	selectedTileId?: ITile['id'] | null;
	remotePageSubmit?: boolean;
	remotePageResult?: FormResultType;
	remotePageChanged?: boolean;
}

/** Where a tile sits in the editor right now, saved or not (cells count from 1, as the backend stores them) */
export interface IPageConfigureTilePlace {
	id: ITile['id'];
	hidden: boolean;
	row: number;
	col: number;
	rowSpan: number;
	colSpan: number;
}

export interface IPageConfigureExpose {
	hideTile: (id: ITile['id']) => void;
	showTile: (id: ITile['id']) => boolean;
	removeTile: (id: ITile['id']) => void;
}
