import type { IDisplayProfile } from '../store/displays-profiles.store.types';

export type LayoutOverride = {
	rows?: number | null;
	cols?: number | null;
	tileSize?: number | null;
};

export type CalculatedLayout = {
	rows: number;
	cols: number;
	tileSize: number;
	mode: 'fixedGridSize' | 'fixedTileSize';
};

/**
 * Given a display profile + overrides (rows/cols or tileSize),
 * calculates the effective rows, cols, and tileSize.
 *
 * Only two modes:
 * - fixedTileSize (tileSize provided) → derive rows/cols
 * - fixedGridSize (rows/cols provided) → derive tileSize
 */
export const calculateLayout = (profile: IDisplayProfile, override: LayoutOverride): CalculatedLayout => {
	const { screenWidth, screenHeight, rows: profileRows, cols: profileCols } = profile;

	if (override.tileSize && override.tileSize > 0) {
		// Fixed tile size → calculate rows/cols
		const cols = Math.max(1, Math.floor(screenWidth / override.tileSize));
		const rows = Math.max(1, Math.floor(screenHeight / override.tileSize));

		// Recalculate exact sizes (Flutter behaviour)
		const tileWidth = Math.floor(screenWidth / cols);

		return {
			rows,
			cols,
			tileSize: tileWidth,
			mode: 'fixedTileSize',
		};
	}

	// Fixed grid size → calculate tile size
	const cols = override.cols ?? profileCols;
	const rows = override.rows ?? profileRows;

	const tileWidth = Math.floor(screenWidth / cols);

	return {
		rows,
		cols,
		tileSize: tileWidth,
		mode: 'fixedGridSize',
	};
};
