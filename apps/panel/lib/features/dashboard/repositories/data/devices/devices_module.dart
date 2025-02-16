import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel_control.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel_property.dart';
import 'package:fastybird_smart_panel/api/models/devices_device_control.dart';
import 'package:fastybird_smart_panel/api/models/devices_res_devices_data_union.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:flutter/foundation.dart';

class DevicesModuleRepository extends ChangeNotifier {
  final DevicesModuleClient _apiClient;

  final List<DeviceDataModel> _devices = [];
  final List<DeviceControlDataModel> _devicesControls = [];
  final List<ChannelDataModel> _channels = [];
  final List<ChannelPropertyDataModel> _channelsProperties = [];
  final List<ChannelControlDataModel> _channelsControls = [];

  bool _isLoading = true;

  DevicesModuleRepository({
    required DevicesModuleClient apiClient,
  }) : _apiClient = apiClient;

  Future<void> initialize() async {
    _isLoading = true;

    await _loadDevices();

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  List<DeviceDataModel> getDevices(List<String> ids) {
    return _devices.where((device) => ids.contains(device.id)).toList();
  }

  DeviceDataModel? getDevice(String id) {
    try {
      return _devices.firstWhere((device) => device.id == id);
    } catch (e) {
      return null;
    }
  }

  ChannelDataModel? getChannel(String id) {
    try {
      return _channels.firstWhere((channel) => channel.id == id);
    } catch (e) {
      return null;
    }
  }

  List<ChannelDataModel> getChannels(List<String> ids) {
    return _channels.where((channel) => ids.contains(channel.id)).toList();
  }

  ChannelPropertyDataModel? getChannelProperty(String id) {
    try {
      return _channelsProperties.firstWhere((property) => property.id == id);
    } catch (e) {
      return null;
    }
  }

  List<ChannelPropertyDataModel> getChannelsProperties(List<String> ids) {
    return _channelsProperties
        .where((property) => ids.contains(property.id))
        .toList();
  }

  bool toggleDeviceOnState(String id) {
    final DeviceDataModel? device = getDevice(id);

    if (device == null) {
      return false;
    }

    final properties = device.channels
        .expand((channel) => channel.properties)
        .where((property) => property.category == PropertyCategoryType.on)
        .toList();

    for (var property in properties) {
      if (togglePropertyValue(property.id) == false) {
        return false;
      }
    }

    return true;
  }

  bool togglePropertyValue(String id) {
    final ChannelPropertyDataModel? property = getChannelProperty(id);

    if (property == null) {
      return false;
    }

    if (property.value is! BooleanValueType) {
      debugPrint('Only boolean values could be toggled');
    }

    return setPropertyValue(id, !(property.value as BooleanValueType).value);
  }

  bool setPropertyValue(String id, dynamic value) {
    ChannelPropertyDataModel? property = getChannelProperty(id);

    if (property == null) {
      return false;
    }

    final int propertyIndex = _channelsProperties.indexWhere(
      (item) => item.id == property!.id,
    );

    if (propertyIndex == -1) {
      return false;
    }

    if (property.dataType == DataTypeType.boolean) {
      try {
        property = property.copyWith(
          value: BooleanValueType(_valueToBoolean(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataTypeType.char ||
        property.dataType == DataTypeType.uchar ||
        property.dataType == DataTypeType.short ||
        property.dataType == DataTypeType.ushort ||
        property.dataType == DataTypeType.int ||
        property.dataType == DataTypeType.uint ||
        property.dataType == DataTypeType.float) {
      try {
        property = property.copyWith(
          value: NumberValueType(_valueToNumber(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataTypeType.string ||
        property.dataType == DataTypeType.enumerate) {
      property = property.copyWith(
        value: StringValueType(value.toString()),
      );
    } else {
      return false;
    }

    _channelsProperties[propertyIndex] = property;

    ChannelDataModel? channel = getChannel(property.channel);

    if (channel == null) {
      return false;
    }

    final int channelIndex = _channels.indexWhere(
      (item) => item.id == channel.id,
    );

    if (channelIndex == -1) {
      return false;
    }

    channel.property = property;

    _channels[channelIndex] = channel;

    DeviceDataModel? device = getDevice(channel.device);

    if (device == null) {
      return false;
    }

    final int deviceIndex = _devices.indexWhere(
      (item) => item.id == device.id,
    );

    if (deviceIndex == -1) {
      return false;
    }

    device.channel = channel;

    _devices[deviceIndex] = device;

    notifyListeners();

    return true;
  }

  bool _valueToBoolean(dynamic value) {
    if (value is bool) {
      return value;
    }

    if (value is String) {
      return value.toLowerCase() == 'true' || value == '1';
    }

    if (value is num) {
      return value != 0;
    }

    throw ArgumentError('Cannot convert value to boolean: $value');
  }

  num _valueToNumber(dynamic value) {
    if (value is num) {
      return value;
    }

    if (value is String) {
      final parsedValue = num.tryParse(value);

      if (parsedValue != null) {
        return parsedValue;
      }
    }

    throw ArgumentError('Cannot convert value to number: $value');
  }

  Future<void> _loadDevices() async {
    var resConfig = await _fetchDevices();

    _devices.clear();
    _devicesControls.clear();
    _channels.clear();
    _channelsControls.clear();
    _channelsProperties.clear();

    _devices.addAll(
      resConfig
          .map(
            (apiDevice) {
              final DeviceCategoryType? category = DeviceCategoryType.fromValue(
                apiDevice.category.json ?? DeviceCategoryType.generic.value,
              );

              if (category == null || apiDevice.category.json == null) {
                if (kDebugMode) {
                  print(
                    'Unknown device category: "${apiDevice.category.json}" for device: "${apiDevice.id}"',
                  );
                }

                return null;
              }

              final List<DeviceControlDataModel> controls =
                  _parseDeviceControls(apiDevice.controls);

              final List<ChannelDataModel> channels = _parseChannels(
                apiDevice.channels,
              );

              final DeviceChannelsSpecification channelsSpec =
                  buildDeviceChannelsSpecification(category);

              final missingChannels = channelsSpec.required
                  .where(
                    (requiredChannel) => !channels.any(
                      (channel) => channel.category == requiredChannel,
                    ),
                  )
                  .toList();

              if (missingChannels.isNotEmpty) {
                if (kDebugMode) {
                  print(
                    'Missing required channels: "${missingChannels.map((channel) => channel.value).join(", ")}" for device category: "$category" - "${apiDevice.id}".',
                  );
                }

                return null;
              }

              try {
                final device = buildDeviceModel(
                  {
                    "id": apiDevice.id,
                    "category": apiDevice.category.json,
                    "name": apiDevice.name,
                    "description": apiDevice.description,
                    "created_at": apiDevice.createdAt.toIso8601String(),
                    "updated_at": apiDevice.updatedAt?.toIso8601String(),
                  },
                  controls,
                  channels
                      .where(
                        (channel) => channelsSpec.all.contains(
                          channel.category,
                        ),
                      )
                      .toList(),
                );

                _devicesControls.addAll(controls);

                _channels.addAll(
                  channels
                      .where(
                        (channel) => channelsSpec.all.contains(
                          channel.category,
                        ),
                      )
                      .toList(),
                );

                return device;
              } catch (e) {
                return null;
              }
            },
          )
          .whereType<DeviceDataModel>()
          .toList(),
    );
  }

  List<DeviceControlDataModel> _parseDeviceControls(
    List<DevicesDeviceControl> controls,
  ) {
    return controls.map(
      (apiData) {
        return DeviceControlDataModel.fromJson({
          "id": apiData.id,
          "device": apiData.device,
          "name": apiData.name,
          "created_at": apiData.createdAt.toIso8601String(),
          "updated_at": apiData.updatedAt?.toIso8601String(),
        });
      },
    ).toList();
  }

  List<ChannelDataModel> _parseChannels(
    List<DevicesChannel> channels,
  ) {
    return channels
        .map((apiChannel) {
          final ChannelCategoryType? category = ChannelCategoryType.fromValue(
            apiChannel.category.json ?? ChannelCategoryType.generic.value,
          );

          if (category == null || apiChannel.category.json == null) {
            if (kDebugMode) {
              print(
                'Unknown channel category: "${apiChannel.category.json}" for channel: "${apiChannel.id}"',
              );
            }

            return null;
          }

          final List<ChannelControlDataModel> controls =
              _parseChannelControls(apiChannel.controls);

          final List<ChannelPropertyDataModel> properties =
              _parseChannelProperties(apiChannel.properties);

          final ChannelPropertiesSpecification propertiesSpec =
              buildChannelPropertiesSpecification(category);

          final missingProperties = propertiesSpec.required
              .where(
                (requiredProp) => !properties.any(
                  (property) => property.category == requiredProp,
                ),
              )
              .toList();

          if (missingProperties.isNotEmpty) {
            if (kDebugMode) {
              print(
                'Missing required properties: "${missingProperties.map((prop) => prop.value).join(", ")}" for channel category: "$category" - "${apiChannel.id}".',
              );
            }

            return null;
          }

          try {
            final ChannelDataModel channel = buildChannelModel(
              {
                "id": apiChannel.id,
                "device": apiChannel.device,
                "category": apiChannel.category.json,
                "name": apiChannel.name,
                "description": apiChannel.description,
                "created_at": apiChannel.createdAt.toIso8601String(),
                "updated_at": apiChannel.updatedAt?.toIso8601String(),
              },
              properties
                  .where(
                    (property) => propertiesSpec.all.contains(
                      property.category,
                    ),
                  )
                  .toList(),
              controls,
            );

            _channelsControls.addAll(controls);

            _channelsProperties.addAll(
              properties
                  .where(
                    (property) => propertiesSpec.all.contains(
                      property.category,
                    ),
                  )
                  .toList(),
            );

            return channel;
          } catch (e) {
            return null;
          }
        })
        .whereType<ChannelDataModel>()
        .toList();
  }

  List<ChannelControlDataModel> _parseChannelControls(
    List<DevicesChannelControl> controls,
  ) {
    return controls.map(
      (apiData) {
        return ChannelControlDataModel.fromJson({
          "id": apiData.id,
          "channel": apiData.channel,
          "name": apiData.name,
          "created_at": apiData.createdAt.toIso8601String(),
          "updated_at": apiData.updatedAt?.toIso8601String(),
        });
      },
    ).toList();
  }

  List<ChannelPropertyDataModel> _parseChannelProperties(
    List<DevicesChannelProperty> properties,
  ) {
    return properties.map(
      (apiData) {
        return ChannelPropertyDataModel.fromJson({
          "id": apiData.id,
          "channel": apiData.channel,
          "category": apiData.category.json,
          "name": apiData.name,
          "permission": apiData.permission
              .map((item) => item.json)
              .whereType<String>()
              .toList(),
          "data_type": apiData.dataType.json,
          "unit": apiData.unit,
          "format": apiData.format,
          "invalid": apiData.invalid,
          "step": apiData.step,
          "value": apiData.value,
          "created_at": apiData.createdAt.toIso8601String(),
          "updated_at": apiData.updatedAt?.toIso8601String(),
        });
      },
    ).toList();
  }

  Future<List<DevicesResDevicesDataUnion>> _fetchDevices() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getDevicesModuleDevices();

        return response.data.data;
      },
      'fetch devices',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
