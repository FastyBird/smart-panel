import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateHousePageDto } from '../dto/create-page.dto';
import { HousePageEntity } from '../entities/pages-house.entity';
import { PAGES_HOUSE_TYPE } from '../pages-house.constants';
import { PagesHouseValidationException } from '../pages-house.exceptions';

import { HousePageNestedBuilderService } from './page-create-nested-builder.service';

describe('HousePageNestedBuilderService', () => {
	let service: HousePageNestedBuilderService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [HousePageNestedBuilderService],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get(HousePageNestedBuilderService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('supports', () => {
		it('should support "pages-house" page type', () => {
			expect(service.supports({ type: PAGES_HOUSE_TYPE } as CreateHousePageDto)).toBe(true);
		});

		it('should not support other page types', () => {
			expect(service.supports({ type: 'unknown' } as CreatePageDto)).toBe(false);
		});
	});

	describe('build', () => {
		it('should set default values when not provided', async () => {
			const page = new HousePageEntity();
			page.id = uuid();

			const dto = {
				type: PAGES_HOUSE_TYPE,
				title: 'Test House Page',
				order: 1,
			} as CreateHousePageDto;

			await service.build(dto, page);

			expect(page.viewMode).toBe('simple');
			expect(page.showWeather).toBe(true);
		});

		it('should set view_mode when provided', async () => {
			const page = new HousePageEntity();
			page.id = uuid();

			const dto = {
				type: PAGES_HOUSE_TYPE,
				title: 'Test House Page',
				order: 1,
				view_mode: 'detailed',
			} as CreateHousePageDto;

			await service.build(dto, page);

			expect(page.viewMode).toBe('detailed');
		});

		it('should set show_weather when provided', async () => {
			const page = new HousePageEntity();
			page.id = uuid();

			const dto = {
				type: PAGES_HOUSE_TYPE,
				title: 'Test House Page',
				order: 1,
				show_weather: false,
			} as CreateHousePageDto;

			await service.build(dto, page);

			expect(page.showWeather).toBe(false);
		});
	});

	describe('validateDto', () => {
		it('should throw validation error for invalid DTO', async () => {
			await expect(service['validateDto'](class {}, {})).rejects.toThrow(PagesHouseValidationException);
		});
	});
});
