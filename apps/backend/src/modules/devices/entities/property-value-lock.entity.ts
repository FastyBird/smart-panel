import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('devices_module_property_value_locks')
export class PropertyValueLockEntity {
	@PrimaryColumn({ type: 'varchar' })
	propertyId!: string;

	@Column({ type: 'varchar' })
	ownerToken!: string;

	@Column({ type: 'integer' })
	expiresAt!: number;
}
