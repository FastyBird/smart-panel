import { type Ref, ref } from 'vue';
import { useCookies } from 'vue3-cookies';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';
import { MODULES_PREFIX } from '../../../app.constants';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../auth/auth.constants';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

// Detect Home Assistant ingress prefix so direct fetch() calls resolve behind
// a path-prefixed reverse proxy
const ingressMatch = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
const ingressBase = ingressMatch ? ingressMatch[1] : '';

export type IBackupContribution = components['schemas']['SystemModuleDataBackupContribution'];
export type IBackup = components['schemas']['SystemModuleDataBackup'];

export interface IUseBackups {
	backups: Ref<IBackup[]>;
	loading: Ref<boolean>;
	creating: Ref<boolean>;
	fetchBackups: () => Promise<void>;
	createBackup: (name?: string) => Promise<IBackup | null>;
	deleteBackup: (id: string) => Promise<boolean>;
	restoreBackup: (id: string) => Promise<boolean>;
	downloadBackup: (backup: IBackup) => Promise<void>;
	uploadBackup: (file: File) => Promise<boolean>;
}

export const useBackups = (): IUseBackups => {
	const backend = useBackend();
	const { cookies } = useCookies();

	const backups = ref<IBackup[]>([]);
	const loading = ref(false);
	const creating = ref(false);

	// Ingress-aware base for the two multipart fetch() calls below that bypass the
	// openapi-fetch client. The typed API calls use literal paths so openapi-fetch
	// can infer the correct request/response shapes without `as any` casts.
	const backupsFetchBase = `${window.location.origin}${ingressBase}/api/v1/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/backups`;

	const fetchBackups = async (): Promise<void> => {
		loading.value = true;

		try {
			const { data: responseData, error } = await backend.client.GET('/modules/system/backups', {});

			if (error || !responseData?.data) {
				return;
			}

			backups.value = responseData.data;
		} catch {
			// handled by caller
		} finally {
			loading.value = false;
		}
	};

	const createBackup = async (name?: string): Promise<IBackup | null> => {
		creating.value = true;

		try {
			const body = name ? { data: { name } } : undefined;

			const { data: responseData, error } = await backend.client.POST('/modules/system/backups', { body });

			if (error || !responseData?.data) {
				return null;
			}

			const created = responseData.data;

			await fetchBackups();

			return created;
		} catch {
			return null;
		} finally {
			creating.value = false;
		}
	};

	const deleteBackup = async (id: string): Promise<boolean> => {
		try {
			// openapi-fetch does not throw on HTTP errors — inspect `error` to avoid
			// silently reporting success on 4xx/5xx responses
			const { error } = await backend.client.DELETE('/modules/system/backups/{id}', {
				params: { path: { id } },
			});

			if (error) {
				return false;
			}

			await fetchBackups();

			return true;
		} catch {
			return false;
		}
	};

	const restoreBackup = async (id: string): Promise<boolean> => {
		try {
			// openapi-fetch does not throw on HTTP errors — inspect `error` to avoid
			// silently reporting success on 4xx/5xx responses
			const { error } = await backend.client.POST('/modules/system/backups/{id}/restore', {
				params: { path: { id } },
			});

			if (error) {
				return false;
			}

			return true;
		} catch {
			return false;
		}
	};

	const downloadBackup = async (backup: IBackup): Promise<void> => {
		const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);

		const url = `${backupsFetchBase}/${backup.id}/download`;

		const response = await fetch(url, {
			headers: {
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
		});

		if (!response.ok) {
			throw new Error('Download failed');
		}

		const blob = await response.blob();
		const link = document.createElement('a');
		const objectUrl = URL.createObjectURL(blob);

		link.href = objectUrl;
		link.download = `smart-panel-backup-${backup.name || backup.id}.tar.gz`;
		link.click();

		// Defer revocation — Safari in particular may not have captured a reference
		// to the blob by the time click() returns synchronously, and revoking in the
		// same tick can produce an empty download
		setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
	};

	const uploadBackup = async (file: File): Promise<boolean> => {
		const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);

		const url = `${backupsFetchBase}/upload`;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
				},
				body: formData,
			});

			if (!response.ok) {
				return false;
			}

			await fetchBackups();

			return true;
		} catch {
			return false;
		}
	};

	return {
		backups,
		loading,
		creating,
		fetchBackups,
		createBackup,
		deleteBackup,
		restoreBackup,
		downloadBackup,
		uploadBackup,
	};
};
