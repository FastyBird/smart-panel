import { type Ref, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { AUTH_MODULE_PREFIX } from '../auth.constants';

export interface IPersonalToken {
	id: string;
	name: string;
	description: string | null;
	owner_type: string;
	owner_id: string | null;
	expires_at: string | null;
	revoked: boolean;
	last_used_at: string | null;
	created_at: string;
	updated_at: string | null;
}

export interface ICreatePersonalTokenPayload {
	name: string;
	description?: string | null;
	expires_in_days?: number | null;
}

export interface IPersonalTokenWithValue extends IPersonalToken {
	token: string;
}

interface IUsePersonalTokens {
	tokens: Ref<IPersonalToken[]>;
	loading: Ref<boolean>;
	fetchTokens: () => Promise<void>;
	createToken: (payload: ICreatePersonalTokenPayload) => Promise<IPersonalTokenWithValue | null>;
	revokeToken: (id: string) => Promise<boolean>;
	deleteToken: (id: string) => Promise<boolean>;
}

export const usePersonalTokens = (): IUsePersonalTokens => {
	const backend = useBackend();
	const tokens = ref<IPersonalToken[]>([]);
	const loading = ref(false);

	const fetchTokens = async (): Promise<void> => {
		loading.value = true;
		try {
			const tokensPath = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/tokens`;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { data: responseData } = await backend.client.GET(tokensPath as any);
			if (responseData?.data) {
				tokens.value = (responseData.data as IPersonalToken[]).filter(
					(t) => !t.revoked && t.owner_type === 'user',
				);
			}
		} catch {
			// handled by caller
		} finally {
			loading.value = false;
		}
	};

	const createToken = async (payload: ICreatePersonalTokenPayload): Promise<IPersonalTokenWithValue | null> => {
		try {
			const createPath = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/tokens/personal`;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { data: responseData } = await backend.client.POST(createPath as any, { body: { data: payload } });
			if (responseData?.data) {
				const created = responseData.data as IPersonalTokenWithValue;
				await fetchTokens();
				return created;
			}
		} catch {
			// handled by caller
		}
		return null;
	};

	const revokeToken = async (id: string): Promise<boolean> => {
		try {
			const revokePath = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/tokens/{id}`;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await backend.client.PATCH(revokePath as any, {
				params: { path: { id } },
				body: { data: { type: 'long-live', revoked: true } },
			});
			await fetchTokens();
			return true;
		} catch {
			return false;
		}
	};

	const deleteToken = async (id: string): Promise<boolean> => {
		try {
			const deletePath = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/tokens/{id}`;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await backend.client.DELETE(deletePath as any, { params: { path: { id } } });
			await fetchTokens();
			return true;
		} catch {
			return false;
		}
	};

	return { tokens, loading, fetchTokens, createToken, revokeToken, deleteToken };
};
