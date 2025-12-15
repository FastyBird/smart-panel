import { ElNotification } from 'element-plus';

import type { IFlashMessageOptions, IUseFlashMessage } from './types';

export const useFlashMessage = (): IUseFlashMessage => {
	const success = (message: string, options?: IFlashMessageOptions): void => {
		ElNotification.success({
			message,
			duration: options?.duration,
		});
	};

	const info = (message: string, options?: IFlashMessageOptions): void => {
		ElNotification.info({
			message,
			duration: options?.duration,
		});
	};

	const warning = (message: string, options?: IFlashMessageOptions): void => {
		ElNotification.warning({
			message,
			duration: options?.duration,
		});
	};

	const error = (message: string, options?: IFlashMessageOptions): void => {
		ElNotification.error({
			message,
			duration: options?.duration,
		});
	};

	const exception = (errorMessage: string, options?: IFlashMessageOptions): void => {
		ElNotification.error({
			message: errorMessage,
			duration: options?.duration,
		});
	};

	return {
		success,
		info,
		warning,
		error,
		exception,
	};
};
