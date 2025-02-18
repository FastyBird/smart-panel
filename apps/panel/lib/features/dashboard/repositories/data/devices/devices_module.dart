import 'package:collection/collection.dart';
import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel_control.dart';
import 'package:fastybird_smart_panel/api/models/devices_channel_property.dart';
import 'package:fastybird_smart_panel/api/models/devices_device_control.dart';
import 'package:fastybird_smart_panel/api/models/devices_res_devices_data_union.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data/device.dart';
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
    return _devices
        .where((device) => ids.contains(device.id) && !device.invalid)
        .toList();
  }

  DeviceDataModel? getDevice(String id) {
    return _devices
        .firstWhereOrNull((device) => device.id == id && !device.invalid);
  }

  List<ChannelDataModel> getChannels(List<String> ids) {
    return _channels
        .where((channel) => ids.contains(channel.id) && !channel.invalid)
        .toList();
  }

  ChannelDataModel? getChannel(String id) {
    return _channels
        .firstWhereOrNull((channel) => channel.id == id && !channel.invalid);
  }

  ChannelPropertyDataModel? getChannelProperty(String id) {
    return _channelsProperties
        .firstWhereOrNull((property) => property.id == id);
  }

  List<ChannelPropertyDataModel> getChannelsProperties(List<String> ids) {
    return _channelsProperties
        .where((property) => ids.contains(property.id))
        .toList();
  }

  Future<bool> toggleDeviceOnState(String id) async {
    final DeviceDataModel? device = getDevice(id);

    if (device == null) {
      return false;
    }

    final properties = getChannels(device.channels)
        .expand((channel) => getChannelsProperties(channel.properties))
        .where((property) => property.category == PropertyCategoryType.on)
        .toList();

    for (var property in properties) {
      if (await togglePropertyValue(property.id) == false) {
        return false;
      }
    }

    return true;
  }

  Future<bool> togglePropertyValue(String id) async {
    final ChannelPropertyDataModel? property = getChannelProperty(id);

    if (property == null) {
      return false;
    }

    if (property.dataType != DataTypeType.boolean) {
      debugPrint('Only boolean values could be toggled');
    }

    bool setValue = false;

    if (property.value == null) {
      setValue = true;
    } else {
      setValue = !(property.value as BooleanValueType).value;
    }

    return await setPropertyValue(
      id,
      setValue,
    );
  }

  Future<bool> setPropertyValue(String id, dynamic value) async {
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
    var resDevices = await _fetchDevices();

    _devices.clear();
    _devicesControls.clear();
    _channels.clear();
    _channelsControls.clear();
    _channelsProperties.clear();

    _parseDevices(resDevices);
  }

  /// ///////
  /// DEVICES
  /// ///////

  void _parseDevices(
    List<DevicesResDevicesDataUnion> apiDevices,
  ) {
    for (var apiDevice in apiDevices) {
      final DeviceCategoryType? category = DeviceCategoryType.fromValue(
        apiDevice.category.json ?? DeviceCategoryType.generic.value,
      );

      if (category == null || apiDevice.category.json == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown device category: "${apiDevice.category.json}" for device: "${apiDevice.id}"',
          );
        }

        continue;
      }

      try {
        _devices.add(
          buildDeviceModel(category, {
            "id": apiDevice.id,
            "category": apiDevice.category.json,
            "name": apiDevice.name,
            "description": apiDevice.description,
            "created_at": apiDevice.createdAt.toIso8601String(),
            "updated_at": apiDevice.updatedAt?.toIso8601String(),
            "controls": apiDevice.controls
                .map(
                  (control) => control.id,
                )
                .toList(),
            "channels": apiDevice.channels
                .map(
                  (channel) => channel.id,
                )
                .toList(),
          }),
        );
      } catch (e) {
        continue;
      }

      _parseDeviceControls(apiDevice, apiDevice.controls);
      _parseChannels(apiDevice, apiDevice.channels);

      final DeviceChannelsSpecification channelsSpec =
          buildDeviceChannelsSpecification(category);

      List<ChannelDataModel> channels = getChannels(apiDevice.channels
          .map(
            (channel) => channel.id,
          )
          .toList());

      final missingChannels = channelsSpec.required
          .where(
            (requiredChannel) => !channels.any(
              (channel) => channel.category == requiredChannel,
            ),
          )
          .toList();

      if (missingChannels.isNotEmpty) {
        if (kDebugMode) {
          debugPrint(
            'Missing required channels: "${missingChannels.map((channel) => channel.value).join(", ")}" for device category: "$category" - "${apiDevice.id}".',
          );
        }

        final int deviceIndex = _devices.indexWhere(
          (item) => item.id == apiDevice.id,
        );

        if (deviceIndex != -1) {
          DeviceDataModel device = _devices[deviceIndex];

          /// Device is marked as invalid due to missing required channels
          device.invalid = true;

          _devices[deviceIndex] = device;
        }
      }
    }
  }

  void _parseDeviceControls(
    DevicesResDevicesDataUnion apiDevice,
    List<DevicesDeviceControl> apiControls,
  ) {
    for (var apiControl in apiControls) {
      _devicesControls.add(
        DeviceControlDataModel.fromJson({
          "id": apiControl.id,
          "device": apiDevice.id,
          "name": apiControl.name,
          "created_at": apiControl.createdAt.toIso8601String(),
          "updated_at": apiControl.updatedAt?.toIso8601String(),
        }),
      );
    }
  }

  /// ////////
  /// CHANNELS
  /// ////////

  void _parseChannels(
    DevicesResDevicesDataUnion apiDevice,
    List<DevicesChannel> apiChannels,
  ) {
    for (var apiChannel in apiChannels) {
      final ChannelCategoryType? category = ChannelCategoryType.fromValue(
        apiChannel.category.json ?? ChannelCategoryType.generic.value,
      );

      if (category == null || apiChannel.category.json == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown channel category: "${apiChannel.category.json}" for channel: "${apiChannel.id}"',
          );
        }

        continue;
      }

      try {
        _channels.add(
          buildChannelModel(
            category,
            {
              "id": apiChannel.id,
              "device": apiDevice.id,
              "category": apiChannel.category.json,
              "name": apiChannel.name,
              "description": apiChannel.description,
              "created_at": apiChannel.createdAt.toIso8601String(),
              "updated_at": apiChannel.updatedAt?.toIso8601String(),
              "controls": apiChannel.controls
                  .map(
                    (control) => control.id,
                  )
                  .toList(),
              "properties": apiChannel.properties
                  .map(
                    (property) => property.id,
                  )
                  .toList(),
            },
          ),
        );
      } catch (e) {
        return null;
      }

      _parseChannelControls(apiChannel, apiChannel.controls);
      _parseChannelProperties(apiChannel, apiChannel.properties);

      final ChannelPropertiesSpecification propertiesSpec =
          buildChannelPropertiesSpecification(category);

      List<ChannelPropertyDataModel> properties =
          getChannelsProperties(apiChannel.properties
              .map(
                (property) => property.id,
              )
              .toList());

      final missingProperties = propertiesSpec.required
          .where(
            (requiredProp) => !properties.any(
              (property) => property.category == requiredProp,
            ),
          )
          .toList();

      if (missingProperties.isNotEmpty) {
        if (kDebugMode) {
          debugPrint(
            'Missing required properties: "${missingProperties.map((prop) => prop.value).join(", ")}" for channel category: "$category" - "${apiChannel.id}".',
          );
        }

        final int channelIndex = _channels.indexWhere(
          (item) => item.id == apiChannel.id,
        );

        if (channelIndex != -1) {
          ChannelDataModel channel = _channels[channelIndex];

          /// Channel is marked as invalid due to missing required properties
          channel.invalid = true;

          _channels[channelIndex] = channel;
        }
      }
    }
  }

  void _parseChannelControls(
    DevicesChannel apiChannel,
    List<DevicesChannelControl> apiControls,
  ) {
    for (var apiControl in apiControls) {
      _channelsControls.add(
        ChannelControlDataModel.fromJson({
          "id": apiControl.id,
          "channel": apiChannel.id,
          "name": apiControl.name,
          "created_at": apiControl.createdAt.toIso8601String(),
          "updated_at": apiControl.updatedAt?.toIso8601String(),
        }),
      );
    }
  }

  void _parseChannelProperties(
    DevicesChannel apiChannel,
    List<DevicesChannelProperty> apiProperties,
  ) {
    for (var apiProperty in apiProperties) {
      _channelsProperties.add(
        ChannelPropertyDataModel.fromJson({
          "id": apiProperty.id,
          "channel": apiChannel.id,
          "category": apiProperty.category.json,
          "name": apiProperty.name,
          "permission": apiProperty.permission
              .map((item) => item.json)
              .whereType<String>()
              .toList(),
          "data_type": apiProperty.dataType.json,
          "unit": apiProperty.unit,
          "format": apiProperty.format,
          "invalid": apiProperty.invalid,
          "step": apiProperty.step,
          "value": apiProperty.value,
          "created_at": apiProperty.createdAt.toIso8601String(),
          "updated_at": apiProperty.updatedAt?.toIso8601String(),
        }),
      );
    }
  }

  /// ////////////
  /// API HANDLERS
  /// ////////////

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
