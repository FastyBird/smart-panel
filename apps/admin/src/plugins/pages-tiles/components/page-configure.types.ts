import type { FormResultType } from '../../../modules/dashboard';
import type { ITilesPage } from '../store/pages.store.types';

export interface IPageConfigureProps {
	page: ITilesPage;
	gridLayout: { rows: number; cols: number } | null;
	gridCardStyle: Record<string, string>;
	remotePageSubmit?: boolean;
	remotePageResult?: FormResultType;
	remotePageChanged?: boolean;
}
