// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_module_create_channel_property.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DevicesModuleCreateChannelPropertyImpl
    _$$DevicesModuleCreateChannelPropertyImplFromJson(
            Map<String, dynamic> json) =>
        _$DevicesModuleCreateChannelPropertyImpl(
          id: json['id'] as String,
          category: DevicesModuleChannelPropertyCategory.fromJson(
              json['category'] as String),
          permissions: (json['permissions'] as List<dynamic>)
              .map((e) =>
                  DevicesModuleCreateChannelPropertyPermissions.fromJson(
                      e as String))
              .toList(),
          dataType: DevicesModuleCreateChannelPropertyDataType.fromJson(
              json['data_type'] as String),
          name: json['name'] as String?,
          unit: json['unit'] as String?,
          format: json['format'] as List<dynamic>?,
          invalid: json['invalid'],
          step: json['step'] as num?,
          value: json['value'],
        );

Map<String, dynamic> _$$DevicesModuleCreateChannelPropertyImplToJson(
        _$DevicesModuleCreateChannelPropertyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category':
          _$DevicesModuleChannelPropertyCategoryEnumMap[instance.category]!,
      'permissions': instance.permissions
          .map(
              (e) => _$DevicesModuleCreateChannelPropertyPermissionsEnumMap[e]!)
          .toList(),
      'data_type': _$DevicesModuleCreateChannelPropertyDataTypeEnumMap[
          instance.dataType]!,
      'name': instance.name,
      'unit': instance.unit,
      'format': instance.format,
      'invalid': instance.invalid,
      'step': instance.step,
      'value': instance.value,
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

const _$DevicesModuleCreateChannelPropertyPermissionsEnumMap = {
  DevicesModuleCreateChannelPropertyPermissions.ro: 'ro',
  DevicesModuleCreateChannelPropertyPermissions.rw: 'rw',
  DevicesModuleCreateChannelPropertyPermissions.wo: 'wo',
  DevicesModuleCreateChannelPropertyPermissions.ev: 'ev',
  DevicesModuleCreateChannelPropertyPermissions.$unknown: r'$unknown',
};

const _$DevicesModuleCreateChannelPropertyDataTypeEnumMap = {
  DevicesModuleCreateChannelPropertyDataType.char: 'char',
  DevicesModuleCreateChannelPropertyDataType.uchar: 'uchar',
  DevicesModuleCreateChannelPropertyDataType.short: 'short',
  DevicesModuleCreateChannelPropertyDataType.ushort: 'ushort',
  DevicesModuleCreateChannelPropertyDataType.int: 'int',
  DevicesModuleCreateChannelPropertyDataType.uint: 'uint',
  DevicesModuleCreateChannelPropertyDataType.float: 'float',
  DevicesModuleCreateChannelPropertyDataType.bool: 'bool',
  DevicesModuleCreateChannelPropertyDataType.string: 'string',
  DevicesModuleCreateChannelPropertyDataType.valueEnum: 'enum',
  DevicesModuleCreateChannelPropertyDataType.unknown: 'unknown',
  DevicesModuleCreateChannelPropertyDataType.$unknown: r'$unknown',
};
