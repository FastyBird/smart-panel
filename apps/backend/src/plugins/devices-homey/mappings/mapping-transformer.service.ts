import { Injectable } from '@nestjs/common';

import { DataTypeType } from '../../../modules/devices/devices.constants';
import { HomeyCapabilityValue } from '../models/homey-capability.model';

import { HomeyMappingValueError } from './homey-mapping.error';
import { HomeyMappingScalar, HomeyTransformDefinition, ResolvedHomeyPropertyMapping } from './mapping.types';

type HomeyTransformDirection = 'read' | 'write';

const INTEGER_DATA_TYPES = new Set<DataTypeType>([
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
]);

@Injectable()
export class HomeyMappingTransformerService {
	read(mapping: ResolvedHomeyPropertyMapping, value: HomeyCapabilityValue): HomeyMappingScalar {
		this.assertDirection(mapping, 'read');
		const transformed = this.transform(mapping, 'read', value);

		return this.normalizePanelValue(mapping, transformed);
	}

	write(mapping: ResolvedHomeyPropertyMapping, value: HomeyMappingScalar): HomeyCapabilityValue {
		this.assertDirection(mapping, 'write');
		this.assertPanelValue(mapping, 'write', value);

		return this.transform(mapping, 'write', value);
	}

	private assertDirection(mapping: ResolvedHomeyPropertyMapping, direction: HomeyTransformDirection): void {
		const allowed =
			mapping.property.direction === 'bidirectional' ||
			(direction === 'read' && mapping.property.direction === 'read_only') ||
			(direction === 'write' && mapping.property.direction === 'write_only');

		if (!allowed) {
			throw this.error(mapping, direction, `mapping direction is ${mapping.property.direction}`);
		}
	}

	private transform(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		value: HomeyMappingScalar,
	): HomeyMappingScalar {
		if (value === null || mapping.property.transform === undefined) {
			return value;
		}

		const transform = mapping.property.transform;

		switch (transform.type) {
			case 'scale':
				return this.scale(mapping, direction, transform, value);
			case 'map':
				return this.map(mapping, direction, transform, value);
			case 'boolean':
				return this.boolean(mapping, direction, transform, value);
			case 'clamp':
				return this.clamp(mapping, direction, transform.minimum, transform.maximum, value);
			case 'round':
				return this.round(mapping, direction, transform.precision ?? 0, value);
		}
	}

	private scale(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		transform: Extract<HomeyTransformDefinition, { type: 'scale' }>,
		value: HomeyMappingScalar,
	): number {
		const numericValue = this.requireFiniteNumber(mapping, direction, value);
		const inputRange = direction === 'read' ? transform.input_range : transform.output_range;
		const outputRange = direction === 'read' ? transform.output_range : transform.input_range;
		const boundedValue = transform.clamp
			? Math.max(Math.min(inputRange[0], inputRange[1]), Math.min(Math.max(inputRange[0], inputRange[1]), numericValue))
			: numericValue;
		const ratio = (boundedValue - inputRange[0]) / (inputRange[1] - inputRange[0]);
		const result = outputRange[0] + ratio * (outputRange[1] - outputRange[0]);

		return Object.is(result, -0) ? 0 : result;
	}

	private map(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		transform: Extract<HomeyTransformDefinition, { type: 'map' }>,
		value: HomeyMappingScalar,
	): HomeyMappingScalar {
		const table = direction === 'read' ? transform.read : transform.write;
		const key = String(value);

		if (table === undefined || !Object.hasOwn(table, key)) {
			throw this.error(mapping, direction, 'value is not present in the explicit map table');
		}

		return table[key];
	}

	private boolean(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		transform: Extract<HomeyTransformDefinition, { type: 'boolean' }>,
		value: HomeyMappingScalar,
	): HomeyMappingScalar {
		if (direction === 'read') {
			if (value !== transform.true_value && value !== transform.false_value) {
				throw this.error(mapping, direction, 'value does not match either declared boolean representation');
			}

			const result = value === transform.true_value;
			return transform.invert === true ? !result : result;
		}

		if (typeof value !== 'boolean') {
			throw this.error(mapping, direction, 'expected a boolean panel value');
		}

		const result = transform.invert === true ? !value : value;
		return result ? transform.true_value : transform.false_value;
	}

	private clamp(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		minimum: number,
		maximum: number,
		value: HomeyMappingScalar,
	): number {
		return Math.max(minimum, Math.min(maximum, this.requireFiniteNumber(mapping, direction, value)));
	}

	private round(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		precision: number,
		value: HomeyMappingScalar,
	): number {
		const factor = 10 ** precision;
		return Math.round(this.requireFiniteNumber(mapping, direction, value) * factor) / factor;
	}

	private normalizePanelValue(mapping: ResolvedHomeyPropertyMapping, value: HomeyMappingScalar): HomeyMappingScalar {
		if (value === null || mapping.property.dataType === DataTypeType.UNKNOWN) {
			return value;
		}

		if (INTEGER_DATA_TYPES.has(mapping.property.dataType)) {
			return Math.round(this.requireFiniteNumber(mapping, 'read', value));
		}

		this.assertPanelValue(mapping, 'read', value);
		return value;
	}

	private assertPanelValue(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		value: HomeyMappingScalar,
	): void {
		if (value === null || mapping.property.dataType === DataTypeType.UNKNOWN) {
			return;
		}

		const valid = (() => {
			switch (mapping.property.dataType) {
				case DataTypeType.BOOL:
					return typeof value === 'boolean';
				case DataTypeType.FLOAT:
					return typeof value === 'number' && Number.isFinite(value);
				case DataTypeType.STRING:
				case DataTypeType.ENUM:
					return typeof value === 'string';
				default:
					return INTEGER_DATA_TYPES.has(mapping.property.dataType) && Number.isInteger(value);
			}
		})();

		if (!valid) {
			throw this.error(mapping, direction, `value does not match ${mapping.property.dataType} data type`);
		}
	}

	private requireFiniteNumber(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		value: HomeyMappingScalar,
	): number {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw this.error(mapping, direction, 'expected a finite number');
		}

		return value;
	}

	private error(
		mapping: ResolvedHomeyPropertyMapping,
		direction: HomeyTransformDirection,
		reason: string,
	): HomeyMappingValueError {
		return new HomeyMappingValueError(mapping.name, direction, reason);
	}
}
