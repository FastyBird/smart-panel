import { extendCategoryCheck, reduceCategoryCheck } from '../utils/category-check.utils';

const SQL = `CREATE TABLE "t" ("id" varchar PRIMARY KEY NOT NULL, "category" varchar CHECK( "category" IN ('generic','motion') ) NOT NULL DEFAULT ('generic'), "dataType" varchar CHECK( "dataType" IN ('bool','enum') ) NOT NULL, "catalogBirth" integer)`;

describe('category CHECK helpers', () => {
	it('appends values to the category list only', () => {
		expect(extendCategoryCheck(SQL, ['object_detection', 'sound_detection'])).toBe(
			SQL.replace(`('generic','motion')`, `('generic','motion','object_detection','sound_detection')`),
		);
	});

	it('is reversible', () => {
		const extended = extendCategoryCheck(SQL, ['object_detection']);

		expect(reduceCategoryCheck(extended, ['object_detection'])).toBe(SQL);
	});

	it('throws when the category CHECK is missing or appears twice', () => {
		expect(() => extendCategoryCheck(SQL.replace('"category" varchar CHECK', '"category" varchar'), ['x'])).toThrow();
		expect(() => extendCategoryCheck(`${SQL}; ${SQL}`, ['x'])).toThrow();
	});

	it('throws when a value is already present, or absent on reduce', () => {
		expect(() => extendCategoryCheck(SQL, ['motion'])).toThrow();
		expect(() => reduceCategoryCheck(SQL, ['object_detection'])).toThrow();
	});

	it('rejects values that are not lowercase snake case', () => {
		expect(() => extendCategoryCheck(SQL, [`x') OR 1=1 --`])).toThrow();
	});
});
