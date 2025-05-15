import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import { type ManagerOptions, Socket, type SocketOptions, io } from 'socket.io-client';

export const socketsKey: InjectionKey<Socket | undefined> = Symbol('FB-App-Sockets');

export const injectSockets = (app?: App): Socket => {
	if (app && app._context && app._context.provides && app._context.provides[socketsKey]) {
		return app._context.provides[socketsKey];
	}

	if (hasInjectionContext()) {
		const socketInstance = _inject(socketsKey, undefined);

		if (socketInstance) {
			return socketInstance;
		}
	}

	throw new Error('A router guard has not been provided.');
};

export const SocketsPlugin = {
	install(app: App, options: { baseUrl: string } & Partial<ManagerOptions & SocketOptions>) {
		const socketInstance = io(options.baseUrl, {
			auth: {},
			transports: ['websocket'],
			autoConnect: false,
			// reconnection: false,
		});

		socketInstance.on('connect', () => {
			socketInstance.emit('subscribe-exchange');
		});

		app.provide(socketsKey, socketInstance);
		app.config.globalProperties.$socket = socketInstance;
	},
};
