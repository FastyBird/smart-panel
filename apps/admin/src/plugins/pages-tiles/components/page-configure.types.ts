import type { FormResultType } from '../../../modules/dashboard';
import type { ITilesPage } from '../store/pages.store.types';

export interface IPageConfigureProps {
	page: ITilesPage;
	remotePageSubmit?: boolean;
	remotePageResult?: FormResultType;
	remotePageChanged?: boolean;
}
