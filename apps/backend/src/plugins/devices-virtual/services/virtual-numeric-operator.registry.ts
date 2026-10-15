import {
	NumericOperatorDefinition,
	NumericOperatorDescriptor,
	snapshotNumericOperator,
} from '@fastybird/smart-panel-extension-sdk';
import { Injectable } from '@nestjs/common';

export interface NumericOperatorScope {
	readonly definition: NumericOperatorDefinition;
	readonly isCurrent: () => boolean;
}
interface Activation {
	readonly token: object;
	readonly definitions: ReadonlyMap<string, NumericOperatorDefinition>;
}

/** Host-owned package namespaces and exact versions; no implicit latest or concurrent replacement. */
@Injectable()
export class VirtualNumericOperatorRegistry {
	private readonly owners = new Map<string, Activation>();
	private readonly listeners = new Set<(operatorIds: readonly string[]) => void>();
	private epoch = 0;

	generation(): number {
		return this.epoch;
	}
	observe(listener: (ids: readonly string[]) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	activate(pkgName: string, definitions: readonly NumericOperatorDefinition[]): () => void {
		if (
			!/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]{0,213}$/.test(pkgName) ||
			this.owners.has(pkgName) ||
			definitions.length > 64 ||
			pkgName.length > 214
		)
			throw new Error('Numeric operator owner conflict');
		const items = new Map<string, NumericOperatorDefinition>();
		for (const raw of definitions) {
			const definition = snapshotNumericOperator(raw);
			const id = `${pkgName}:${definition.name}`;
			if (items.has(id)) throw new Error('Duplicate numeric operator/version');
			items.set(id, definition);
		}
		const activation = Object.freeze({ token: Object.freeze({}), definitions: items });
		this.owners.set(pkgName, activation);
		this.changed([...items.keys()]);
		let disposed = false;
		return () => {
			if (disposed) return;
			disposed = true;
			if (this.owners.get(pkgName) !== activation) return;
			this.owners.delete(pkgName);
			this.changed([...items.keys()]);
		};
	}
	capture(id: string, version: number): NumericOperatorScope | null {
		for (const [owner, activation] of this.owners) {
			const definition = activation.definitions.get(id);
			if (definition?.operatorVersion === version)
				return Object.freeze({ definition, isCurrent: () => this.owners.get(owner) === activation });
		}
		return null;
	}
	catalogue(): ReadonlyArray<NumericOperatorDescriptor & { operatorId: string }> {
		return [...this.owners.values()].flatMap(({ definitions }) =>
			[...definitions].map(([operatorId, definition]) => {
				const descriptor: NumericOperatorDescriptor = {
					contractVersion: definition.contractVersion,
					name: definition.name,
					operatorVersion: definition.operatorVersion,
					input: definition.input,
					output: definition.output,
					inputRange: definition.inputRange,
					outputRange: definition.outputRange,
					parameters: definition.parameters,
				};
				return Object.freeze({ ...descriptor, operatorId });
			}),
		);
	}
	private changed(ids: readonly string[]): void {
		this.epoch++;
		for (const listener of this.listeners) listener(ids);
	}
}
