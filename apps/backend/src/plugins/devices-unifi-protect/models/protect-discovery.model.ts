import { Expose, Type } from 'class-transformer';
import { Equals, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ProtectProbeCertificate, ProtectProbeResult } from '../services/protect-discovery-probe.service';
import {
	ProtectDiscoveryFailureReason,
	ProtectDiscoveryStatus,
	ProtectDiscoveryWarning,
	ProtectInterfaceErrorCode,
	ProtectInterfaceStatus,
	ProtectPresence,
	ProtectProbeFailure,
	ProtectProbeStatus,
} from '../services/protect-discovery.constants';

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataDiscoveryInterface' })
export class ProtectDiscoveryInterfaceModel {
	@ApiProperty({ description: 'Network interface name', example: 'en0' })
	@Expose({ name: 'name' })
	@IsString()
	name: string;

	@ApiProperty({ description: 'IPv4 address of the interface', example: '192.168.1.5' })
	@Expose({ name: 'address' })
	@IsString()
	address: string;

	@ApiProperty({ description: 'Subnet broadcast address the discovery request was sent to', example: '192.168.1.255' })
	@Expose({ name: 'broadcast_address' })
	@IsString()
	broadcastAddress: string;

	@ApiProperty({ description: 'Whether the interface took part in the scan', enum: ProtectInterfaceStatus })
	@Expose({ name: 'status' })
	@IsEnum(ProtectInterfaceStatus)
	status: ProtectInterfaceStatus;

	@ApiPropertyOptional({
		description: 'First error seen on the interface',
		enum: ProtectInterfaceErrorCode,
		nullable: true,
	})
	@Expose({ name: 'error_code' })
	@IsOptional()
	@IsEnum(ProtectInterfaceErrorCode)
	errorCode: ProtectInterfaceErrorCode | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataProbeCertificate' })
export class ProtectProbeCertificateModel implements ProtectProbeCertificate {
	@ApiProperty({ description: 'Always true: the certificate was checked', example: true })
	@Expose({ name: 'checked' })
	@Equals(true)
	checked: true;

	@ApiProperty({ description: 'Direct-connect domain the certificate was verified against' })
	@Expose({ name: 'domain' })
	@IsString()
	domain: string;

	@ApiPropertyOptional({
		description: 'Whether the certificate verified for the domain; null when it could not be determined',
		nullable: true,
	})
	@Expose({ name: 'valid' })
	@IsOptional()
	@IsBoolean()
	valid: boolean | null;

	@ApiPropertyOptional({ description: 'Error code when the verification failed', nullable: true })
	@Expose({ name: 'error_code' })
	@IsOptional()
	@IsString()
	errorCode: string | null;

	@ApiPropertyOptional({ description: 'End of the certificate validity period', nullable: true })
	@Expose({ name: 'valid_to' })
	@IsOptional()
	@IsString()
	validTo: string | null;

	@ApiProperty({ description: 'Whether the domain resolves to the probed host' })
	@Expose({ name: 'domain_resolves_to_host' })
	@IsBoolean()
	domainResolvesToHost: boolean;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataProbe' })
export class ProtectProbeModel implements ProtectProbeResult {
	@ApiProperty({ description: 'Probed host', example: '192.168.1.10' })
	@Expose({ name: 'host' })
	@IsString()
	host: string;

	@ApiProperty({ description: 'Probed port', example: 443 })
	@Expose({ name: 'port' })
	@IsInt()
	port: number;

	@ApiProperty({ description: 'Probe classification', enum: ProtectProbeStatus })
	@Expose({ name: 'status' })
	@IsEnum(ProtectProbeStatus)
	status: ProtectProbeStatus;

	@ApiPropertyOptional({
		description: 'Failure reason when the host was unreachable',
		enum: ProtectProbeFailure,
		nullable: true,
	})
	@Expose({ name: 'failure' })
	@IsOptional()
	@IsEnum(ProtectProbeFailure)
	failure: ProtectProbeFailure | null;

	@ApiProperty({ description: 'Whether UniFi Protect is present on the console', enum: ProtectPresence })
	@Expose({ name: 'protect' })
	@IsEnum(ProtectPresence)
	protect: ProtectPresence;

	@ApiPropertyOptional({ description: 'Console model', nullable: true })
	@Expose({ name: 'model' })
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiPropertyOptional({ description: 'Console name', nullable: true })
	@Expose({ name: 'name' })
	@IsOptional()
	@IsString()
	name: string | null;

	@ApiPropertyOptional({ description: 'Console MAC address', nullable: true })
	@Expose({ name: 'mac' })
	@IsOptional()
	@IsString()
	mac: string | null;

	@ApiPropertyOptional({ description: 'Console device state', nullable: true })
	@Expose({ name: 'device_state' })
	@IsOptional()
	@IsString()
	deviceState: string | null;

	@ApiPropertyOptional({ description: 'Direct-connect domain of the console', nullable: true })
	@Expose({ name: 'direct_connect_domain' })
	@IsOptional()
	@IsString()
	directConnectDomain: string | null;

	@ApiPropertyOptional({
		description: 'Certificate check against the direct-connect domain',
		type: () => ProtectProbeCertificateModel,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => ProtectProbeCertificateModel)
	certificate: ProtectProbeCertificateModel | null;

	@ApiPropertyOptional({
		description:
			'Host to save in the configuration: the direct-connect domain when its certificate is valid, else the probed host',
		nullable: true,
	})
	@Expose({ name: 'preferred_host' })
	@IsOptional()
	@IsString()
	preferredHost: string | null;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataDiscoveredConsole' })
export class ProtectDiscoveredConsoleModel {
	@ApiProperty({ description: 'Console MAC address' })
	@Expose({ name: 'mac' })
	@IsString()
	mac: string;

	@ApiProperty({ description: 'Address the console replied from', example: '192.168.1.10' })
	@Expose({ name: 'host' })
	@IsString()
	host: string;

	@ApiProperty({ description: 'Addresses the console replied from', type: [String] })
	@Expose({ name: 'addresses' })
	@IsArray()
	@IsString({ each: true })
	addresses: string[];

	@ApiPropertyOptional({ description: 'Console hostname', nullable: true })
	@Expose({ name: 'hostname' })
	@IsOptional()
	@IsString()
	hostname: string | null;

	@ApiPropertyOptional({ description: 'Short model name', nullable: true })
	@Expose({ name: 'model' })
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiPropertyOptional({ description: 'Firmware version', nullable: true })
	@Expose({ name: 'firmware' })
	@IsOptional()
	@IsString()
	firmware: string | null;

	@ApiPropertyOptional({ description: 'Direct-connect domain', nullable: true })
	@Expose({ name: 'direct_connect_domain' })
	@IsOptional()
	@IsString()
	directConnectDomain: string | null;

	@ApiPropertyOptional({ description: 'Console UUID', nullable: true })
	@Expose({ name: 'uuid' })
	@IsOptional()
	@IsString()
	uuid: string | null;

	@ApiProperty({ description: 'Unauthenticated probe of the console', type: () => ProtectProbeModel })
	@Expose()
	@ValidateNested()
	@Type(() => ProtectProbeModel)
	probe: ProtectProbeModel;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataDiscovery' })
export class ProtectDiscoveryModel {
	@ApiProperty({ description: 'State of the discovery scan', enum: ProtectDiscoveryStatus })
	@Expose({ name: 'status' })
	@IsEnum(ProtectDiscoveryStatus)
	status: ProtectDiscoveryStatus;

	@ApiPropertyOptional({ description: 'Why the scan failed', enum: ProtectDiscoveryFailureReason, nullable: true })
	@Expose({ name: 'failure_reason' })
	@IsOptional()
	@IsEnum(ProtectDiscoveryFailureReason)
	failureReason: ProtectDiscoveryFailureReason | null;

	@ApiProperty({
		description: 'Non-fatal conditions found during the scan',
		enum: ProtectDiscoveryWarning,
		isArray: true,
	})
	@Expose({ name: 'warnings' })
	@IsArray()
	@IsEnum(ProtectDiscoveryWarning, { each: true })
	warnings: ProtectDiscoveryWarning[];

	@ApiPropertyOptional({ description: 'When the last scan started', nullable: true })
	@Expose({ name: 'started_at' })
	@IsOptional()
	@IsString()
	startedAt: string | null;

	@ApiPropertyOptional({ description: 'When the last scan finished', nullable: true })
	@Expose({ name: 'finished_at' })
	@IsOptional()
	@IsString()
	finishedAt: string | null;

	@ApiProperty({
		description: 'Network interfaces used for the scan',
		type: 'array',
		items: { $ref: getSchemaPath(ProtectDiscoveryInterfaceModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProtectDiscoveryInterfaceModel)
	interfaces: ProtectDiscoveryInterfaceModel[];

	@ApiProperty({
		description: 'UniFi OS consoles found on the local network',
		type: 'array',
		items: { $ref: getSchemaPath(ProtectDiscoveredConsoleModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProtectDiscoveredConsoleModel)
	consoles: ProtectDiscoveredConsoleModel[];

	@ApiProperty({ description: 'Number of other UniFi devices that replied', example: 0 })
	@Expose({ name: 'other_unifi_devices' })
	@IsInt()
	otherUnifiDevices: number;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResDiscovery' })
export class ProtectDiscoveryResponseModel extends BaseSuccessResponseModel<ProtectDiscoveryModel> {
	@ApiProperty({ type: () => ProtectDiscoveryModel })
	@Expose()
	declare data: ProtectDiscoveryModel;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResProbe' })
export class ProtectProbeResponseModel extends BaseSuccessResponseModel<ProtectProbeModel> {
	@ApiProperty({ type: () => ProtectProbeModel })
	@Expose()
	declare data: ProtectProbeModel;
}
