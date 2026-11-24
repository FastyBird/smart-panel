import type { IDataSource, ITile } from '../../../modules/dashboard';

import type { IPageConfigureTilePlace } from './page-configure.types';

export interface ITilesInspectorProps {
	/** The selected tile's place in the editor, or null with nothing selected */
	place: IPageConfigureTilePlace | null;
	tile: ITile | null;
	dataSources: IDataSource[];
	dataSourcesLoading: boolean;
}
