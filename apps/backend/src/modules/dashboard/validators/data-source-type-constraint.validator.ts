import {
	ValidationArguments,
	ValidationError,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	buildMessage,
	registerDecorator,
	validate,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { IValidationResult } from '../../../app.interfaces';
import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';

interface ValidatableObject {
	validationErrors?: IValidationResult[];
}

@Injectable()
@ValidatorConstraint({ name: 'DataSourceTypeValidation', async: true })
export class DataSourceTypeConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly mapper: DataSourcesTypeMapperService) {}

	public async validate(dataSources: CreateDataSourceDto[] | undefined, args: ValidationArguments) {
		if (!Array.isArray(dataSources)) {
			return false;
		}

		const validationErrors: IValidationResult[] = [];
		const objectWithErrors = args.object as ValidatableObject;

		for (const [index, dataSource] of dataSources.entries()) {
			const mapping = this.mapper.getMapping(dataSource.type);

			const instance = toInstance(mapping.createDto, dataSource, {
				excludeExtraneousValues: false,
			});

			const dataSourcesErrors: ValidationError[] = await validate(instance, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (dataSourcesErrors.length > 0) {
				dataSourcesErrors.forEach((error) => {
					Object.keys(error.constraints || {}).forEach((constraintKey) => {
						try {
							const parsedConstraint = JSON.parse(error.constraints?.[constraintKey] ?? '{}') as
								| IValidationResult
								| IValidationResult[];

							if (Array.isArray(parsedConstraint)) {
								parsedConstraint.forEach((item) =>
									validationErrors.push({
										field: `data_source.${index}.${item.field}`,
										reason: item.reason || 'Invalid value',
									}),
								);
							} else {
								validationErrors.push({
									field: `data_source.${index}.${parsedConstraint.field}`,
									reason: parsedConstraint.reason || 'Invalid value',
								});
							}
						} catch {
							validationErrors.push({
								field: `data_source.${index}.${error.property}`,
								reason: error.constraints?.[constraintKey] || 'Invalid value',
							});
						}
					});
				});
			}
		}

		if (validationErrors.length > 0) {
			objectWithErrors.validationErrors = validationErrors;
			return false;
		}

		return true;
	}

	public defaultMessage = buildMessage(
		(_eachPrefix, args?: ValidationArguments) => {
			const objectWithErrors = args?.object as ValidatableObject | undefined;

			if (objectWithErrors?.validationErrors?.length) {
				return JSON.stringify(objectWithErrors.validationErrors);
			}

			return `[{"field":"${args?.property ?? 'data_source'}","reason":"Invalid data source data."}]`;
		},
		{ each: true },
	);
}

export const ValidateDataSourceType = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateDataSourceType',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: DataSourceTypeConstraintValidator,
		});
	};
};
