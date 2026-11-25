/** The fields of a data source form the host frame edits; a plugin's form model has them along with its own */
export interface IDataSourceFormFrameModel {
	id?: string;
}

export interface IDataSourceFormFrameProps {
	model: IDataSourceFormFrameModel;
}
