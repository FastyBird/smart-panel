/** The fields of a page form the host frame edits; a plugin's form model has them along with its own */
export interface IPageFormFrameModel {
	id?: string;
	title?: string;
	icon?: string | null;
	order?: number;
	showTopBar?: boolean;
	displays?: string[] | null;
}

export interface IPageFormFrameProps {
	model: IPageFormFrameModel;
}
