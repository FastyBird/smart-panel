import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionsCardsProps {
	items: IExtension[];
	loading?: boolean;
	filtersActive?: boolean;
	containerHeight?: number;
}
