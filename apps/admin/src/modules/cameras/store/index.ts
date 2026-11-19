export * from './keys';

export { registerCamerasStore, useCameras } from './cameras.store';
export { registerRelayStatusStore, useRelayStatus } from './relay-status.store';
export type { IRelayStatus, IRelayStatusStoreActions, IRelayStatusStoreState, RelayStatusStoreSetup } from './relay-status.store';
export type {
	ICamera,
	ICameraProfile,
	ICamerasGetActionPayload,
	ICamerasStoreActions,
	ICamerasStoreState,
	CamerasStoreSetup,
} from './cameras.store.types';

export * from './cameras.store.schemas';
export * from './relay-status.store.schemas';
