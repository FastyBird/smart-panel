import { plainToInstance } from 'class-transformer';
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
import { CreateTileDto } from '../dto/create-tile.dto';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';

interface ValidatableObject {
	validationErrors?: IValidationResult[];
}

@Injectable()
@ValidatorConstraint({ name: 'PageTileTypeValidation', async: true })
export class PageTileTypeConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly mapper: TilesTypeMapperService) {}

	public async validate(tiles: CreateTileDto[] | undefined, args: ValidationArguments) {
		if (!Array.isArray(tiles)) {
			return false;
		}

		const validationErrors: IValidationResult[] = [];
		const objectWithErrors = args.object as ValidatableObject;

		for (const [index, tile] of tiles.entries()) {
			const mapping = this.mapper.getMapping(tile.type);

			const instance = plainToInstance(
				mapping.createDto,
				{ ...tile },
				{
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				},
			);

			const tileErrors: ValidationError[] = await validate(instance, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (tileErrors.length > 0) {
				tileErrors.forEach((error) => {
					Object.keys(error.constraints || {}).forEach((constraintKey) => {
						try {
							const parsedConstraint = JSON.parse(error.constraints?.[constraintKey] ?? '{}') as
								| IValidationResult
								| IValidationResult[];

							if (Array.isArray(parsedConstraint)) {
								parsedConstraint.forEach((item) =>
									validationErrors.push({
										field: `tiles.${index}.${item.field}`,
										reason: item.reason || 'Invalid value',
									}),
								);
							} else {
								validationErrors.push({
									field: `tiles.${index}.${parsedConstraint.field}`,
									reason: parsedConstraint.reason || 'Invalid value',
								});
							}
						} catch {
							validationErrors.push({
								field: `tiles.${index}.${error.property}`,
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

			return `[{"field":"${args?.property ?? 'tiles'}","reason":"Invalid tile data."}]`;
		},
		{ each: true },
	);
}

export const ValidatePageTiles = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidatePageTiles',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: PageTileTypeConstraintValidator,
		});
	};
};
