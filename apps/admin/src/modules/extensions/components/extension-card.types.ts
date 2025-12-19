import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionCardProps {
	extension: IExtension;
}

export interface IExtensionCardEmits {
	(e: 'toggle-enabled', type: IExtension['type'], enabled: boolean): void;
	(e: 'detail', type: IExtension['type']): void;
}
