import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useLogger } from '../../../common';
import { IntentStatus } from '../intents.constants';
import { IntentsValidationException } from '../intents.exceptions';

import { IntentSchema } from './intents.store.schemas';
import { type IIntentRes, transformIntentResponse } from './intents.store.transformers';
import type {
	IIntent,
	IIntentsOnEventActionPayload,
	IIntentsSetActionPayload,
	IIntentsStateSemaphore,
	IIntentsStoreActions,
	IIntentsStoreState,
	IIntentsUnsetActionPayload,
} from './intents.store.types';

export type IntentsStoreSetup = IIntentsStoreState & IIntentsStoreActions;

const createDefaultSemaphore = (): IIntentsStateSemaphore => ({
	fetching: false,
});

export const useIntentsStore = defineStore<'intents_module-intents', IntentsStoreSetup>('intents_module-intents', (): IntentsStoreSetup => {
	const logger = useLogger();

	const semaphore = ref<IIntentsStateSemaphore>(createDefaultSemaphore());

	const data = ref<Map<IIntent['id'], IIntent>>(new Map());

	const findAll = (): IIntent[] => Array.from(data.value.values());

	const findById = (id: IIntent['id']): IIntent | null => data.value.get(id) ?? null;

	const findPending = (): IIntent[] => {
		return Array.from(data.value.values()).filter((intent) => intent.status === IntentStatus.PENDING);
	};

	const onEvent = (payload: IIntentsOnEventActionPayload): IIntent => {
		return set({
			id: payload.id,
			data: transformIntentResponse(payload.data as unknown as IIntentRes, IntentSchema),
		});
	};

	const set = (payload: IIntentsSetActionPayload): IIntent => {
		const existingIntent = data.value.get(payload.id);

		if (existingIntent) {
			const parsed = IntentSchema.safeParse({ ...existingIntent, ...payload.data });

			if (!parsed.success) {
				logger.error('[INTENTS] Schema validation failed:', parsed.error);

				throw new IntentsValidationException('Failed to update intent.');
			}

			data.value.set(parsed.data.id, parsed.data);
			return parsed.data;
		}

		const parsed = IntentSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('[INTENTS] Schema validation failed:', parsed.error);

			throw new IntentsValidationException('Failed to insert intent.');
		}

		data.value.set(parsed.data.id, parsed.data);
		return parsed.data;
	};

	const unset = (payload: IIntentsUnsetActionPayload): void => {
		data.value.delete(payload.id);
	};

	const clear = (): void => {
		data.value.clear();
	};

	return {
		data,
		semaphore,
		findAll,
		findById,
		findPending,
		onEvent,
		set,
		unset,
		clear,
	};
});

export const registerIntentsStore = (pinia: Pinia): Store<string, IIntentsStoreState, object, IIntentsStoreActions> => {
	return useIntentsStore(pinia);
};
