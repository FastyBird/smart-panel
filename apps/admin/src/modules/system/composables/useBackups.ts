import { type Ref, ref } from 'vue';
import { useCookies } from 'vue3-cookies';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../auth/auth.constants';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

export interface IBackupContribution {
	source: string;
	label: string;
	type: string;
	path: string;
}

export interface IBackup {
	id: string;
	name: string;
	version: string;
	created_at: string;
	size_bytes: number;
	contributions: IBackupContribution[];
}

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

	const backupsBasePath = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/backups`;

	const fetchBackups = async (): Promise<void> => {
		loading.value = true;

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { data: responseData } = await backend.client.GET(backupsBasePath as any, {});

			if (responseData?.data) {
				backups.value = responseData.data as IBackup[];
			}
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

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { data: responseData } = await backend.client.POST(backupsBasePath as any, { body });

			if (responseData?.data) {
				const created = responseData.data as IBackup;

				await fetchBackups();

				return created;
			}
		} catch {
			// handled by caller
		} finally {
			creating.value = false;
		}

		return null;
	};

	const deleteBackup = async (id: string): Promise<boolean> => {
		try {
			const deletePath = `${backupsBasePath}/{id}`;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await backend.client.DELETE(deletePath as any, { params: { path: { id } } });

			await fetchBackups();

			return true;
		} catch {
			return false;
		}
	};

	const restoreBackup = async (id: string): Promise<boolean> => {
		try {
			const restorePath = `${backupsBasePath}/{id}/restore`;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await backend.client.POST(restorePath as any, { params: { path: { id } } });

			return true;
		} catch {
			return false;
		}
	};

	const downloadBackup = async (backup: IBackup): Promise<void> => {
		const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);

		const url = `${window.location.origin}/api/v1${backupsBasePath}/${backup.id}/download`;

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

		link.href = URL.createObjectURL(blob);
		link.download = `smart-panel-backup-${backup.name || backup.id}.tar.gz`;
		link.click();

		URL.revokeObjectURL(link.href);
	};

	const uploadBackup = async (file: File): Promise<boolean> => {
		const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);

		const url = `${window.location.origin}/api/v1${backupsBasePath}/upload`;

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

	return { backups, loading, creating, fetchBackups, createBackup, deleteBackup, restoreBackup, downloadBackup, uploadBackup };
};
