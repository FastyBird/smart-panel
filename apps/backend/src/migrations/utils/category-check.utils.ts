const CATEGORY_CHECK = /("category" varchar CHECK\( "category" IN \()([^)]*)(\) \))/g;
const VALUE = /^[a-z][a-z0-9_]*$/;

const parseList = (list: string): string[] =>
	list.split(',').map((item) => {
		const match = /^'([a-z][a-z0-9_]*)'$/.exec(item.trim());

		if (!match) {
			throw new Error(`Unexpected entry in the stored category CHECK list: ${item.trim()}`);
		}

		return match[1];
	});

const assertValues = (values: readonly string[]): void => {
	if (values.length === 0) {
		throw new Error('At least one category value is required');
	}

	for (const value of values) {
		if (!VALUE.test(value)) {
			throw new Error(`Category value "${value}" is not lowercase snake case`);
		}
	}

	if (new Set(values).size !== values.length) {
		throw new Error('Category values must be unique');
	}
};

const rewriteCategoryCheck = (tableSql: string, rewrite: (current: string[]) => string[]): string => {
	const matches = [...tableSql.matchAll(CATEGORY_CHECK)];

	if (matches.length !== 1) {
		throw new Error(`Expected exactly one category CHECK constraint, found ${matches.length}`);
	}

	const [whole, head, list, tail] = matches[0];
	const next = rewrite(parseList(list))
		.map((value) => `'${value}'`)
		.join(',');
	const start = matches[0].index;

	return `${tableSql.slice(0, start)}${head}${next}${tail}${tableSql.slice(start + whole.length)}`;
};

/**
 * Append categories to the `"category" varchar CHECK( "category" IN (...) )` list inside a stored CREATE TABLE
 * statement. Throws when the constraint is missing or ambiguous, or when a value is already present.
 */
export const extendCategoryCheck = (tableSql: string, values: readonly string[]): string => {
	assertValues(values);

	return rewriteCategoryCheck(tableSql, (current) => {
		const present = values.filter((value) => current.includes(value));

		if (present.length > 0) {
			throw new Error(`Category CHECK already allows: ${present.join(', ')}`);
		}

		return [...current, ...values];
	});
};

/** Reverse of {@link extendCategoryCheck}: remove categories from the list. Throws when a value is absent. */
export const reduceCategoryCheck = (tableSql: string, values: readonly string[]): string => {
	assertValues(values);

	return rewriteCategoryCheck(tableSql, (current) => {
		const absent = values.filter((value) => !current.includes(value));

		if (absent.length > 0) {
			throw new Error(`Category CHECK does not allow: ${absent.join(', ')}`);
		}

		return current.filter((value) => !values.includes(value));
	});
};
