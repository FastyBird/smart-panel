import type { Ref } from 'vue';
import { inject } from 'vue';

import { spacesRefreshSignalsKey } from '../store/keys';

interface IUseSpacesRefreshSignals {
	climateSignal: Ref<number> | undefined;
	lightingSignal: Ref<number> | undefined;
	coversSignal: Ref<number> | undefined;
	sensorSignal: Ref<number> | undefined;
	climateStateSignal: Ref<number> | undefined;
	lightingStateSignal: Ref<number> | undefined;
	coversStateSignal: Ref<number> | undefined;
	sensorStateSignal: Ref<number> | undefined;
}

export const useSpacesRefreshSignals = (): IUseSpacesRefreshSignals => {
	const refreshSignals = inject(spacesRefreshSignalsKey);

	return {
		climateSignal: refreshSignals?.climate,
		lightingSignal: refreshSignals?.lighting,
		coversSignal: refreshSignals?.covers,
		sensorSignal: refreshSignals?.sensor,
		climateStateSignal: refreshSignals?.climateState,
		lightingStateSignal: refreshSignals?.lightingState,
		coversStateSignal: refreshSignals?.coversState,
		sensorStateSignal: refreshSignals?.sensorState,
	};
};
