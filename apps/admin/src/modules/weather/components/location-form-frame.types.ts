/** The fields of a location form the host frame edits; a plugin's form model has them along with its own */
export interface ILocationFormFrameModel {
	id?: string;
	name?: string;
}

export interface ILocationFormFrameProps {
	model: ILocationFormFrameModel;
	/** Shows the location id under Identifiers; a location being added has none yet */
	showId?: boolean;
}
