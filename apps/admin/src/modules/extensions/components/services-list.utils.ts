import { ExtensionsModuleServiceOwnerKind } from '../../../openapi.constants';
import type { IService } from '../store/services.store.types';

export interface IServicesByOwnerKind {
	modules: IService[];
	plugins: IService[];
}

export const groupServicesByOwnerKind = (services: IService[]): IServicesByOwnerKind => {
	return {
		modules: services.filter((service) => service.extensionKind === ExtensionsModuleServiceOwnerKind.module),
		plugins: services.filter((service) => service.extensionKind === ExtensionsModuleServiceOwnerKind.plugin),
	};
};
