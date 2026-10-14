/** SQLite persistence guards apply equally to entity, bulk/query-builder and raw SQL mutations. */
export const THERMOSTAT_OWNERSHIP_TRIGGERS: Readonly<Record<string, string>> = {
	virtual_thermostat_property_delete: `BEFORE DELETE ON "devices_module_channels_properties"
		WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" WHERE "sourcePropertyId" = OLD."id" AND "state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat actuator is reserved; request qualified release before deletion'); END`,
	virtual_thermostat_channel_delete: `BEFORE DELETE ON "devices_module_channels"
		WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" c JOIN "devices_module_channels_properties" p ON p."id" = c."sourcePropertyId" WHERE p."channelId" = OLD."id" AND c."state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat actuator channel is reserved; request qualified release before deletion'); END`,
	virtual_thermostat_device_delete: `BEFORE DELETE ON "devices_module_devices"
		WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" WHERE ("sourceDeviceId" = OLD."id" OR "controllerId" = OLD."id") AND "state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat actuator or owner is reserved; request qualified release before deletion'); END`,
	virtual_thermostat_property_contract: `BEFORE UPDATE OF "id", "identifier", "category", "dataType", "permissions", "format", "channelId", "type" ON "devices_module_channels_properties"
		WHEN (NEW."id" IS NOT OLD."id" OR NEW."identifier" IS NOT OLD."identifier" OR NEW."category" IS NOT OLD."category" OR NEW."dataType" IS NOT OLD."dataType" OR NEW."permissions" IS NOT OLD."permissions" OR NEW."format" IS NOT OLD."format" OR NEW."channelId" IS NOT OLD."channelId" OR NEW."type" IS NOT OLD."type")
		AND EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" WHERE "sourcePropertyId" = OLD."id" AND "state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat actuator contract is reserved; qualified release and repair required'); END`,
	virtual_thermostat_channel_contract: `BEFORE UPDATE OF "id", "identifier", "category", "deviceId", "type" ON "devices_module_channels"
		WHEN (NEW."id" IS NOT OLD."id" OR NEW."identifier" IS NOT OLD."identifier" OR NEW."category" IS NOT OLD."category" OR NEW."deviceId" IS NOT OLD."deviceId" OR NEW."type" IS NOT OLD."type")
		AND EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" c JOIN "devices_module_channels_properties" p ON p."id" = c."sourcePropertyId" WHERE p."channelId" = OLD."id" AND c."state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat actuator channel is reserved; qualified release and repair required'); END`,
	virtual_thermostat_device_contract: `BEFORE UPDATE OF "id", "identifier", "canonicalMac", "category", "type" ON "devices_module_devices"
		WHEN (NEW."id" IS NOT OLD."id" OR NEW."identifier" IS NOT OLD."identifier" OR NEW."canonicalMac" IS NOT OLD."canonicalMac" OR NEW."category" IS NOT OLD."category" OR NEW."type" IS NOT OLD."type")
		AND EXISTS (SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" WHERE ("sourceDeviceId" = OLD."id" OR "controllerId" = OLD."id") AND "state" != 'released')
		BEGIN SELECT RAISE(ABORT, 'Thermostat hardware identity is reserved; qualified release and repair required'); END`,
	virtual_thermostat_device_disable: `AFTER UPDATE OF "enabled" ON "devices_module_devices"
		WHEN OLD."enabled" = 1 AND NEW."enabled" = 0
		BEGIN
			UPDATE "devices_virtual_thermostat_actuator_claims" SET "state" = CASE WHEN "sourcePropertyId" IS NULL THEN 'missing' ELSE 'releasing' END, "revision" = "revision" + 1, "releaseRequestedAt" = CURRENT_TIMESTAMP, "reason" = 'device_disabled'
			WHERE ("sourceDeviceId" = OLD."id" OR "controllerId" = OLD."id") AND "state" != 'released';
			UPDATE "devices_virtual_thermostat_configs" SET "requestedMode" = 'off', "revision" = "revision" + 1, "releaseRequestedAt" = CURRENT_TIMESTAMP WHERE "ownerDeviceId" = OLD."id";
		END`,
};
