import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionLogsProps {
	extensionType: IExtension['type'];
	live?: boolean;
}
