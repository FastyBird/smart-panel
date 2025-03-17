import { ElNotification } from 'element-plus';

import type { IUseFlashMessage } from './types';

export function useFlashMessage(): IUseFlashMessage {
	const success = (message: string): void => {
		ElNotification.success(message);
	};

	const info = (message: string): void => {
		ElNotification.info(message);
	};

	const error = (message: string): void => {
		ElNotification.error(message);
	};

	const exception = (errorMessage: string): void => {
		ElNotification.error(errorMessage);
	};

	return {
		success,
		info,
		error,
		exception,
	};
}
