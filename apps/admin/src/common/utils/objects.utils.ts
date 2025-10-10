/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { toRaw } from 'vue';

export const snakeToCamel = <T extends Record<string, any>>(obj: T): any => {
	if (Array.isArray(obj)) {
		return obj.map(snakeToCamel);
	} else if (obj !== null && typeof obj === 'object') {
		return Object.entries(obj).reduce(
			(acc, [key, value]) => {
				const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
				acc[camelKey] = snakeToCamel(value);
				return acc;
			},
			{} as Record<string, any>
		);
	}

	return obj;
};

export const camelToSnake = <T extends Record<string, any>>(obj: T): any => {
	if (Array.isArray(obj)) {
		return obj.map(camelToSnake);
	} else if (obj !== null && typeof obj === 'object') {
		return Object.entries(obj).reduce(
			(acc, [key, value]) => {
				const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
				acc[snakeKey] = camelToSnake(value);
				return acc;
			},
			{} as Record<string, any>
		);
	}

	return obj;
};

export const deepClone = <T>(value: T): T => {
	if (typeof structuredClone === 'function') {
		return structuredClone(toRaw(value));
	}

	return JSON.parse(JSON.stringify(toRaw(value)));
};
