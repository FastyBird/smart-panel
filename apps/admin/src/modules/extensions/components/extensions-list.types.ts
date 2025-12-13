import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionsListProps {
	items: IExtension[];
	loading?: boolean;
}

export interface IExtensionsListEmits {
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
}
