import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('mcp_module_installation')
export class McpInstallationEntity {
	@PrimaryColumn({ type: 'varchar' })
	key: string;

	@Column({ type: 'varchar', unique: true })
	installationId: string;

	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	createdAt: Date | string;
}
