import type { IPage } from '../store/pages.store.types';

export interface IViewPageEditProps {
	id: IPage['id'];
	page?: IPage;
	remoteFormChanged?: boolean;
}
