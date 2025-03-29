// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_create_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesCreateChannelPropertyImpl _$$DevicesCreateChannelPropertyImplFromJson(
        Map<String, dynamic> json) =>
    _$DevicesCreateChannelPropertyImpl(
      id: json['id'] as String,
      category:
          DevicesChannelPropertyCategory.fromJson(json['category'] as String),
      permissions: (json['permissions'] as List<dynamic>)
          .map((e) =>
              DevicesCreateChannelPropertyPermissions.fromJson(e as String))
          .toList(),
      dataType: DevicesCreateChannelPropertyDataType.fromJson(
          json['data_type'] as String),
      name: json['name'] as String?,
      unit: json['unit'] as String?,
      format: json['format'] as List<dynamic>?,
      invalid: json['invalid'],
      step: json['step'] as num?,
      value: json['value'],
    );

Map<String, dynamic> _$$DevicesCreateChannelPropertyImplToJson(
        _$DevicesCreateChannelPropertyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$DevicesChannelPropertyCategoryEnumMap[instance.category]!,
      'permissions': instance.permissions
          .map((e) => _$DevicesCreateChannelPropertyPermissionsEnumMap[e]!)
          .toList(),
      'data_type':
          _$DevicesCreateChannelPropertyDataTypeEnumMap[instance.dataType]!,
      'name': instance.name,
      'unit': instance.unit,
      'format': instance.format,
      'invalid': instance.invalid,
      'step': instance.step,
      'value': instance.value,
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

const _$DevicesCreateChannelPropertyPermissionsEnumMap = {
  DevicesCreateChannelPropertyPermissions.ro: 'ro',
  DevicesCreateChannelPropertyPermissions.rw: 'rw',
  DevicesCreateChannelPropertyPermissions.wo: 'wo',
  DevicesCreateChannelPropertyPermissions.ev: 'ev',
  DevicesCreateChannelPropertyPermissions.$unknown: r'$unknown',
};

const _$DevicesCreateChannelPropertyDataTypeEnumMap = {
  DevicesCreateChannelPropertyDataType.char: 'char',
  DevicesCreateChannelPropertyDataType.uchar: 'uchar',
  DevicesCreateChannelPropertyDataType.short: 'short',
  DevicesCreateChannelPropertyDataType.ushort: 'ushort',
  DevicesCreateChannelPropertyDataType.int: 'int',
  DevicesCreateChannelPropertyDataType.uint: 'uint',
  DevicesCreateChannelPropertyDataType.float: 'float',
  DevicesCreateChannelPropertyDataType.bool: 'bool',
  DevicesCreateChannelPropertyDataType.string: 'string',
  DevicesCreateChannelPropertyDataType.valueEnum: 'enum',
  DevicesCreateChannelPropertyDataType.unknown: 'unknown',
  DevicesCreateChannelPropertyDataType.$unknown: r'$unknown',
};
