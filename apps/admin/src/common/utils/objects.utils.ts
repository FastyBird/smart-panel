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
				const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
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
		return (typeof value !== 'undefined' ? structuredClone(JSON.parse(JSON.stringify(toRaw(value)))) : undefined) as T;
	}

	if (value === null || typeof value !== 'object') {
		return value;
	}

	if (value instanceof Date) {
		return new Date(value.getTime()) as any;
	}

	if (value instanceof Array) {
		const newArr: any[] = [];

		for (let i = 0; i < value.length; i++) {
			newArr[i] = deepClone(value[i]);
		}

		return newArr as any;
	}

	const newObj: { [key: string]: any } = {};

	for (const key in value) {
		if (Object.prototype.hasOwnProperty.call(value, key)) {
			newObj[key] = deepClone((value as any)[key]);
		}
	}

	return newObj as any;
};
