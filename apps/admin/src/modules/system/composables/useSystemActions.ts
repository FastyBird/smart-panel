import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElLoading, ElMessageBox } from 'element-plus';

import { RouteNames } from '../../../app.constants';

import type { IUseSystemActions } from './types';

export const useSystemActions = (): IUseSystemActions => {
	const router = useRouter();
	const { t } = useI18n();

	const onRestart = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmRestart'), t('systemModule.headings.restart'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: 'Processing request...',
					closed: () => {
						router.push({ name: RouteNames.ROOT });
					},
				});
				setTimeout(() => {
					loading.close();
				}, 2000);
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onPowerOff = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmPowerOff'), t('systemModule.headings.powerOff'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: 'Processing request...',
					closed: () => {
						router.push({ name: RouteNames.ROOT });
					},
				});
				setTimeout(() => {
					loading.close();
				}, 2000);
			})
			.catch((): void => {
				// Just ignore
			});
	};

	const onFactoryReset = (): void => {
		ElMessageBox.confirm(t('systemModule.messages.confirmFactoryReset'), t('systemModule.headings.factoryReset'), {
			confirmButtonText: t('systemModule.buttons.yes.title'),
			cancelButtonText: t('systemModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				const loading = ElLoading.service({
					lock: true,
					text: 'Processing request...',
					closed: () => {
						router.push({ name: RouteNames.ROOT });
					},
				});
				setTimeout(() => {
					loading.close();
				}, 2000);
			})
			.catch((): void => {
				// Just ignore
			});
	};

	return {
		onRestart,
		onPowerOff,
		onFactoryReset,
	};
};
