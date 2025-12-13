import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionsListProps {
	items: IExtension[];
	loading?: boolean;
	filtersActive?: boolean;
}

export interface IExtensionsListEmits {
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'detail', type: IExtension['type']): void;
}
