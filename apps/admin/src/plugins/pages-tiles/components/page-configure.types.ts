import type { FormResultType } from '../../../modules/dashboard';
import type { IDisplay } from '../../../modules/displays';
import type { ITilesPage } from '../store/pages.store.types';

export interface IPageConfigureProps {
	page: ITilesPage;
	gridLayout: { rows: number; cols: number } | null;
	gridCardStyle: Record<string, string>;
	displays: IDisplay[];
	selectedDisplay: IDisplay | null;
	remotePageSubmit?: boolean;
	remotePageResult?: FormResultType;
	remotePageChanged?: boolean;
}
