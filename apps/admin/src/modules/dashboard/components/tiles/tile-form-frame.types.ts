/** The fields of a tile form the host frame edits; a plugin's form model has them along with its own */
export interface ITileFormFrameModel {
	id?: string;
	row?: number;
	col?: number;
	rowSpan?: number;
	colSpan?: number;
}

export interface ITileFormFrameProps {
	model: ITileFormFrameModel;
	/** Shows the row and column; off where the page places its tiles itself */
	withPosition?: boolean;
	/** Shows the row and column spans; off where the page sizes its tiles itself */
	withSize?: boolean;
}
