import { type LogObject } from 'consola';

import { injectLogger } from '../services/services';

import type { IUseLogger } from './types';

type Variadic = (...args: ReadonlyArray<unknown>) => void;

type Underlying = { log: Variadic; info: Variadic; warn: Variadic; error: Variadic; fatal: Variadic };

export const useLogger = (): IUseLogger => {
	const rawLogger = injectLogger();
	const logger = rawLogger as Underlying;

	const log = (message: string, ...meta: ReadonlyArray<unknown>) => {
		logger.log(message, ...meta);
	};

	const info = (message: string, ...meta: ReadonlyArray<unknown>) => {
		logger.info(message, ...meta);
	};

	const warn = (message: string, ...meta: ReadonlyArray<unknown>) => {
		logger.warn(message, ...meta);
	};

	// Overloads (keep your signatures), single variadic impl
	function error(message: string, ...meta: ReadonlyArray<unknown>): void;
	function error(error: Error, ...meta: ReadonlyArray<unknown>): void;
	function error(object: LogObject): void;
	function error(...args: ReadonlyArray<unknown>): void {
		logger.error(...args);
	}

	function fatal(message: string, ...meta: ReadonlyArray<unknown>): void;
	function fatal(error: Error, ...meta: ReadonlyArray<unknown>): void;
	function fatal(object: LogObject): void;
	function fatal(...args: ReadonlyArray<unknown>): void {
		logger.fatal(...args);
	}

	return { log, info, warn, error, fatal };
};
