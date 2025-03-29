// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesChannelPropertyImpl _$$DevicesChannelPropertyImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesChannelPropertyImpl(
      id: json['id'] as String,
      category:
          DevicesChannelPropertyCategory.fromJson(json['category'] as String),
      name: json['name'] as String?,
      permissions: (json['permissions'] as List<dynamic>)
          .map((e) => DevicesChannelPropertyPermissions.fromJson(e as String))
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
      dataType: json['data_type'] == null
          ? DevicesChannelPropertyDataType.unknown
          : DevicesChannelPropertyDataType.fromJson(
              json['data_type'] as String),
    );

Map<String, dynamic> _$$DevicesChannelPropertyImplToJson(
        _$DevicesChannelPropertyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesChannelPropertyCategoryEnumMap[instance.category]!,
      'name': instance.name,
      'permissions': instance.permissions
          .map((e) => _$DevicesChannelPropertyPermissionsEnumMap[e]!)
          .toList(),
      'unit': instance.unit,
      'format': instance.format,
      'invalid': instance.invalid,
      'step': instance.step,
      'value': instance.value,
      'channel': instance.channel,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'data_type': _$DevicesChannelPropertyDataTypeEnumMap[instance.dataType]!,
    };

const _$DevicesChannelPropertyCategoryEnumMap = {
  DevicesChannelPropertyCategory.generic: 'generic',
  DevicesChannelPropertyCategory.active: 'active',
  DevicesChannelPropertyCategory.angle: 'angle',
  DevicesChannelPropertyCategory.brightness: 'brightness',
  DevicesChannelPropertyCategory.colorBlue: 'color_blue',
  DevicesChannelPropertyCategory.colorGreen: 'color_green',
  DevicesChannelPropertyCategory.colorRed: 'color_red',
  DevicesChannelPropertyCategory.colorTemperature: 'color_temperature',
  DevicesChannelPropertyCategory.colorWhite: 'color_white',
  DevicesChannelPropertyCategory.connectionType: 'connection_type',
  DevicesChannelPropertyCategory.consumption: 'consumption',
  DevicesChannelPropertyCategory.current: 'current',
  DevicesChannelPropertyCategory.density: 'density',
  DevicesChannelPropertyCategory.detected: 'detected',
  DevicesChannelPropertyCategory.direction: 'direction',
  DevicesChannelPropertyCategory.distance: 'distance',
  DevicesChannelPropertyCategory.duration: 'duration',
  DevicesChannelPropertyCategory.event: 'event',
  DevicesChannelPropertyCategory.fault: 'fault',
  DevicesChannelPropertyCategory.firmwareRevision: 'firmware_revision',
  DevicesChannelPropertyCategory.frequency: 'frequency',
  DevicesChannelPropertyCategory.hardwareRevision: 'hardware_revision',
  DevicesChannelPropertyCategory.hue: 'hue',
  DevicesChannelPropertyCategory.humidity: 'humidity',
  DevicesChannelPropertyCategory.inUse: 'in_use',
  DevicesChannelPropertyCategory.infrared: 'infrared',
  DevicesChannelPropertyCategory.inputSource: 'input_source',
  DevicesChannelPropertyCategory.level: 'level',
  DevicesChannelPropertyCategory.linkQuality: 'link_quality',
  DevicesChannelPropertyCategory.locked: 'locked',
  DevicesChannelPropertyCategory.manufacturer: 'manufacturer',
  DevicesChannelPropertyCategory.measured: 'measured',
  DevicesChannelPropertyCategory.model: 'model',
  DevicesChannelPropertyCategory.mode: 'mode',
  DevicesChannelPropertyCategory.obstruction: 'obstruction',
  DevicesChannelPropertyCategory.valueOn: 'on',
  DevicesChannelPropertyCategory.overCurrent: 'over_current',
  DevicesChannelPropertyCategory.overVoltage: 'over_voltage',
  DevicesChannelPropertyCategory.pan: 'pan',
  DevicesChannelPropertyCategory.peakLevel: 'peak_level',
  DevicesChannelPropertyCategory.percentage: 'percentage',
  DevicesChannelPropertyCategory.position: 'position',
  DevicesChannelPropertyCategory.power: 'power',
  DevicesChannelPropertyCategory.rate: 'rate',
  DevicesChannelPropertyCategory.remaining: 'remaining',
  DevicesChannelPropertyCategory.remoteKey: 'remote_key',
  DevicesChannelPropertyCategory.saturation: 'saturation',
  DevicesChannelPropertyCategory.serialNumber: 'serial_number',
  DevicesChannelPropertyCategory.source: 'source',
  DevicesChannelPropertyCategory.speed: 'speed',
  DevicesChannelPropertyCategory.status: 'status',
  DevicesChannelPropertyCategory.swing: 'swing',
  DevicesChannelPropertyCategory.tampered: 'tampered',
  DevicesChannelPropertyCategory.temperature: 'temperature',
  DevicesChannelPropertyCategory.tilt: 'tilt',
  DevicesChannelPropertyCategory.track: 'track',
  DevicesChannelPropertyCategory.type: 'type',
  DevicesChannelPropertyCategory.units: 'units',
  DevicesChannelPropertyCategory.voltage: 'voltage',
  DevicesChannelPropertyCategory.volume: 'volume',
  DevicesChannelPropertyCategory.zoom: 'zoom',
  DevicesChannelPropertyCategory.$unknown: r'$unknown',
};

const _$DevicesChannelPropertyPermissionsEnumMap = {
  DevicesChannelPropertyPermissions.ro: 'ro',
  DevicesChannelPropertyPermissions.rw: 'rw',
  DevicesChannelPropertyPermissions.wo: 'wo',
  DevicesChannelPropertyPermissions.ev: 'ev',
  DevicesChannelPropertyPermissions.$unknown: r'$unknown',
};

const _$DevicesChannelPropertyDataTypeEnumMap = {
  DevicesChannelPropertyDataType.char: 'char',
  DevicesChannelPropertyDataType.uchar: 'uchar',
  DevicesChannelPropertyDataType.short: 'short',
  DevicesChannelPropertyDataType.ushort: 'ushort',
  DevicesChannelPropertyDataType.int: 'int',
  DevicesChannelPropertyDataType.uint: 'uint',
  DevicesChannelPropertyDataType.float: 'float',
  DevicesChannelPropertyDataType.bool: 'bool',
  DevicesChannelPropertyDataType.string: 'string',
  DevicesChannelPropertyDataType.valueEnum: 'enum',
  DevicesChannelPropertyDataType.unknown: 'unknown',
  DevicesChannelPropertyDataType.$unknown: r'$unknown',
};
