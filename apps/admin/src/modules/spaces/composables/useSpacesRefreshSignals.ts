import type { Ref } from 'vue';
import { inject } from 'vue';

import { spacesRefreshSignalsKey } from '../store/keys';

interface IUseSpacesRefreshSignals {
	climateSignal: Ref<number> | undefined;
	lightingSignal: Ref<number> | undefined;
	climateStateSignal: Ref<number> | undefined;
	lightingStateSignal: Ref<number> | undefined;
}

export const useSpacesRefreshSignals = (): IUseSpacesRefreshSignals => {
	const refreshSignals = inject(spacesRefreshSignalsKey);

	return {
		climateSignal: refreshSignals?.climate,
		lightingSignal: refreshSignals?.lighting,
		climateStateSignal: refreshSignals?.climateState,
		lightingStateSignal: refreshSignals?.lightingState,
	};
};
