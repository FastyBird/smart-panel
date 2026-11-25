import type { ITile } from '../../../modules/dashboard';

export interface ITilesPageListProps {
	tiles: ITile[];
	gridLayout: { rows: number; cols: number } | null;
}
