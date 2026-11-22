import { type InjectionKey, type Ref, inject, onScopeDispose, provide, ref } from 'vue';

export interface IDeviceFormHost {
	/** A plugin form runs its own steps in a wizard-shell: the host leaves out its form footer and the phone Save */
	stepped: Ref<boolean>;
	/** Leaves the form the way the host's Close does, asking first when it has changes */
	close: () => void;
}

const deviceFormHostKey: InjectionKey<IDeviceFormHost> = Symbol('device-form-host');

/** The add and edit views provide it for the plugin form they render */
export const provideDeviceFormHost = (close: () => void): IDeviceFormHost => {
	const host: IDeviceFormHost = { stepped: ref<boolean>(false), close };

	provide(deviceFormHostKey, host);

	return host;
};

/**
 * Called by a plugin form with several steps (spec section 7: multi-step forms become a wizard-shell). While the form
 * is mounted its wizard-shell carries the actions, and Cancel closes the form through the host
 */
export const useDeviceFormSteps = (): { close: () => void } => {
	const host = inject(deviceFormHostKey, null);

	if (host === null) {
		return { close: (): void => {} };
	}

	host.stepped.value = true;

	onScopeDispose((): void => {
		host.stepped.value = false;
	});

	return { close: host.close };
};
