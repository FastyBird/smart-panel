import { HOMEY_CLOUD_CALLBACK_PATH } from '../devices-homey.constants';

export const isSafeHomeyCloudRedirectUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
		const isLoopbackHttp = url.protocol === 'http:' && loopbackHosts.has(url.hostname.toLowerCase());

		return (
			(url.protocol === 'https:' || isLoopbackHttp) &&
			url.username === '' &&
			url.password === '' &&
			url.search === '' &&
			url.hash === '' &&
			url.pathname === HOMEY_CLOUD_CALLBACK_PATH
		);
	} catch {
		return false;
	}
};
