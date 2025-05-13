// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_home_assistant_plugin_home_assistant_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesHomeAssistantPluginHomeAssistantChannelPropertyImpl
    _$$DevicesHomeAssistantPluginHomeAssistantChannelPropertyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesHomeAssistantPluginHomeAssistantChannelPropertyImpl(
          id: json['id'] as String,
          type: json['type'] as String,
          category: DevicesModuleChannelPropertyCategory.fromJson(
              json['category'] as String),
          name: json['name'] as String?,
          permissions: (json['permissions'] as List<dynamic>)
              .map((e) =>
                  DevicesModuleChannelPropertyPermissions.fromJson(e as String))
              .toList(),
          unit: json['unit'] as String?,
          format: json['format'] as List<dynamic>?,
          invalid: json['invalid'],
          step: json['step'] as num?,
          value: json['value'],
          channel: json['channel'] as String,
          createdAt: DateTime.parse(json['created_at'] as String),
          updatedAt: json['updated_at'] == null
              ? null
              : DateTime.parse(json['updated_at'] as String),
          haEntityId: json['ha_entity_id'] as String?,
          haAttribute: json['ha_attribute'] as String?,
          dataType: json['data_type'] == null
              ? DevicesModuleChannelPropertyDataType.unknown
              : DevicesModuleChannelPropertyDataType.fromJson(
                  json['data_type'] as String),
        );

Map<String, dynamic>
    _$$DevicesHomeAssistantPluginHomeAssistantChannelPropertyImplToJson(
            _$DevicesHomeAssistantPluginHomeAssistantChannelPropertyImpl
                instance) =>
        <String, dynamic>{
          'id': instance.id,
          'type': instance.type,
          'category':
              _$DevicesModuleChannelPropertyCategoryEnumMap[instance.category]!,
          'name': instance.name,
          'permissions': instance.permissions
              .map((e) => _$DevicesModuleChannelPropertyPermissionsEnumMap[e]!)
              .toList(),
          'unit': instance.unit,
          'format': instance.format,
          'invalid': instance.invalid,
          'step': instance.step,
          'value': instance.value,
          'channel': instance.channel,
          'created_at': instance.createdAt.toIso8601String(),
          'updated_at': instance.updatedAt?.toIso8601String(),
          'ha_entity_id': instance.haEntityId,
          'ha_attribute': instance.haAttribute,
          'data_type':
              _$DevicesModuleChannelPropertyDataTypeEnumMap[instance.dataType]!,
        };

const _$DevicesModuleChannelPropertyCategoryEnumMap = {
  DevicesModuleChannelPropertyCategory.generic: 'generic',
  DevicesModuleChannelPropertyCategory.active: 'active',
  DevicesModuleChannelPropertyCategory.angle: 'angle',
  DevicesModuleChannelPropertyCategory.brightness: 'brightness',
  DevicesModuleChannelPropertyCategory.colorBlue: 'color_blue',
  DevicesModuleChannelPropertyCategory.colorGreen: 'color_green',
  DevicesModuleChannelPropertyCategory.colorRed: 'color_red',
  DevicesModuleChannelPropertyCategory.colorTemperature: 'color_temperature',
  DevicesModuleChannelPropertyCategory.colorWhite: 'color_white',
  DevicesModuleChannelPropertyCategory.connectionType: 'connection_type',
  DevicesModuleChannelPropertyCategory.consumption: 'consumption',
  DevicesModuleChannelPropertyCategory.current: 'current',
  DevicesModuleChannelPropertyCategory.density: 'density',
  DevicesModuleChannelPropertyCategory.detected: 'detected',
  DevicesModuleChannelPropertyCategory.direction: 'direction',
  DevicesModuleChannelPropertyCategory.distance: 'distance',
  DevicesModuleChannelPropertyCategory.duration: 'duration',
  DevicesModuleChannelPropertyCategory.event: 'event',
  DevicesModuleChannelPropertyCategory.fault: 'fault',
  DevicesModuleChannelPropertyCategory.firmwareRevision: 'firmware_revision',
  DevicesModuleChannelPropertyCategory.frequency: 'frequency',
  DevicesModuleChannelPropertyCategory.hardwareRevision: 'hardware_revision',
  DevicesModuleChannelPropertyCategory.hue: 'hue',
  DevicesModuleChannelPropertyCategory.humidity: 'humidity',
  DevicesModuleChannelPropertyCategory.inUse: 'in_use',
  DevicesModuleChannelPropertyCategory.infrared: 'infrared',
  DevicesModuleChannelPropertyCategory.inputSource: 'input_source',
  DevicesModuleChannelPropertyCategory.level: 'level',
  DevicesModuleChannelPropertyCategory.linkQuality: 'link_quality',
  DevicesModuleChannelPropertyCategory.locked: 'locked',
  DevicesModuleChannelPropertyCategory.manufacturer: 'manufacturer',
  DevicesModuleChannelPropertyCategory.measured: 'measured',
  DevicesModuleChannelPropertyCategory.model: 'model',
  DevicesModuleChannelPropertyCategory.mode: 'mode',
  DevicesModuleChannelPropertyCategory.obstruction: 'obstruction',
  DevicesModuleChannelPropertyCategory.valueOn: 'on',
  DevicesModuleChannelPropertyCategory.overCurrent: 'over_current',
  DevicesModuleChannelPropertyCategory.overVoltage: 'over_voltage',
  DevicesModuleChannelPropertyCategory.overPower: 'over_power',
  DevicesModuleChannelPropertyCategory.pan: 'pan',
  DevicesModuleChannelPropertyCategory.peakLevel: 'peak_level',
  DevicesModuleChannelPropertyCategory.percentage: 'percentage',
  DevicesModuleChannelPropertyCategory.position: 'position',
  DevicesModuleChannelPropertyCategory.power: 'power',
  DevicesModuleChannelPropertyCategory.rate: 'rate',
  DevicesModuleChannelPropertyCategory.remaining: 'remaining',
  DevicesModuleChannelPropertyCategory.remoteKey: 'remote_key',
  DevicesModuleChannelPropertyCategory.saturation: 'saturation',
  DevicesModuleChannelPropertyCategory.serialNumber: 'serial_number',
  DevicesModuleChannelPropertyCategory.source: 'source',
  DevicesModuleChannelPropertyCategory.speed: 'speed',
  DevicesModuleChannelPropertyCategory.status: 'status',
  DevicesModuleChannelPropertyCategory.swing: 'swing',
  DevicesModuleChannelPropertyCategory.tampered: 'tampered',
  DevicesModuleChannelPropertyCategory.temperature: 'temperature',
  DevicesModuleChannelPropertyCategory.tilt: 'tilt',
  DevicesModuleChannelPropertyCategory.track: 'track',
  DevicesModuleChannelPropertyCategory.type: 'type',
  DevicesModuleChannelPropertyCategory.units: 'units',
  DevicesModuleChannelPropertyCategory.voltage: 'voltage',
  DevicesModuleChannelPropertyCategory.volume: 'volume',
  DevicesModuleChannelPropertyCategory.zoom: 'zoom',
  DevicesModuleChannelPropertyCategory.$unknown: r'$unknown',
};

const _$DevicesModuleChannelPropertyPermissionsEnumMap = {
  DevicesModuleChannelPropertyPermissions.ro: 'ro',
  DevicesModuleChannelPropertyPermissions.rw: 'rw',
  DevicesModuleChannelPropertyPermissions.wo: 'wo',
  DevicesModuleChannelPropertyPermissions.ev: 'ev',
  DevicesModuleChannelPropertyPermissions.$unknown: r'$unknown',
};

const _$DevicesModuleChannelPropertyDataTypeEnumMap = {
  DevicesModuleChannelPropertyDataType.char: 'char',
  DevicesModuleChannelPropertyDataType.uchar: 'uchar',
  DevicesModuleChannelPropertyDataType.short: 'short',
  DevicesModuleChannelPropertyDataType.ushort: 'ushort',
  DevicesModuleChannelPropertyDataType.int: 'int',
  DevicesModuleChannelPropertyDataType.uint: 'uint',
  DevicesModuleChannelPropertyDataType.float: 'float',
  DevicesModuleChannelPropertyDataType.bool: 'bool',
  DevicesModuleChannelPropertyDataType.string: 'string',
  DevicesModuleChannelPropertyDataType.valueEnum: 'enum',
  DevicesModuleChannelPropertyDataType.unknown: 'unknown',
  DevicesModuleChannelPropertyDataType.$unknown: r'$unknown',
};
