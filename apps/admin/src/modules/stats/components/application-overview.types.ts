import type { IApiModuleSection, IWebSocketModuleSection } from '../schemas/sections.types';

export type IApplicationOverviewProps = {
	apiModuleSection: IApiModuleSection | undefined;
	websocketModuleSection: IWebSocketModuleSection | undefined;
	loading: boolean;
};
