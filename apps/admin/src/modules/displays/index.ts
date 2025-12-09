export { default as DisplaysModule } from './displays.module';

export { useDisplay, useDisplays } from './composables/composables';
export * from './components/components';
export * from './displays.constants';
export * from './displays.exceptions';
export { registerDisplaysStore } from './store/displays.store';
export * from './store/displays.store.schemas';
export * from './store/displays.store.types';
export * from './store/displays.transformers';
export { displaysStoreKey } from './store/keys';

// Type aliases for backward compatibility with old code
export type { IDisplay as IDisplayProfile } from './store/displays.store.types';
export type { IUseDisplays as IUseDisplaysProfiles } from './composables/useDisplays';

// Function alias for backward compatibility
export { useDisplays as useDisplaysProfiles } from './composables/composables';
