import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { IPageNestedCreateBuilder } from '../../../modules/dashboard/entities/dashboard.relations';
import { CreateHousePageDto } from '../dto/create-page.dto';
import { HousePageEntity } from '../entities/pages-house.entity';
import { PAGES_HOUSE_PLUGIN_NAME, PAGES_HOUSE_TYPE } from '../pages-house.constants';
import { PagesHouseValidationException } from '../pages-house.exceptions';

@Injectable()
export class HousePageNestedBuilderService implements IPageNestedCreateBuilder {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		PAGES_HOUSE_PLUGIN_NAME,
		'HousePageNestedBuilderService',
	);

	supports(dto: CreatePageDto): boolean {
		return dto.type === PAGES_HOUSE_TYPE;
	}

	async build(dto: CreateHousePageDto, page: HousePageEntity): Promise<void> {
		const dtoInstance = await this.validateDto<CreateHousePageDto>(CreateHousePageDto, dto);

		// Set the house page specific properties
		page.viewMode = dtoInstance.view_mode ?? 'simple';
		page.showWeather = dtoInstance.show_weather ?? true;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: unknown): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[PAGES HOUSE][NESTED BUILDER SERVICE] ${JSON.stringify(errors)}`);

			throw new PagesHouseValidationException('Provided house page data is invalid.');
		}

		return dtoInstance;
	}
}
