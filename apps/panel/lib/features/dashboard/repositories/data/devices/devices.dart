import 'dart:convert';

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
import 'package:flutter/services.dart';

class DevicesDataRepository extends ChangeNotifier {
  final List<DeviceDataModel> _devices = [];
  final List<DeviceControlDataModel> _devicesControls = [];
  final List<ChannelDataModel> _channels = [];
  final List<ChannelPropertyDataModel> _channelsProperties = [];
  final List<ChannelControlDataModel> _channelsControls = [];

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      await _loadDevices();
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices repository: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  DeviceDataModel? getDevice(String id) {
    try {
      return _devices.firstWhere((device) => device.id == id);
    } catch (e) {
      return null;
    }
  }

  List<DeviceDataModel> getDevices(List<String> ids) {
    return _devices.where((device) => ids.contains(device.id)).toList();
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

  Future<void> _loadDevices() async {
    try {
      await _loadDevicesControls();
      await _loadDevicesChannels();

      // Load properties JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/devices.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _devices.clear();
      _devices.addAll(
        jsonList
            .map(
              (json) {
                final DeviceCategoryType? category =
                    DeviceCategoryType.fromValue(
                  json['category'],
                );

                if (category == null) {
                  if (kDebugMode) {
                    print(
                        'Unknown device category: "${json['category']}" for device: "${json['id']}"');
                  }

                  return null;
                }

                final List<ChannelDataModel> channels = _channels
                    .where((channel) => channel.device == json['id'])
                    .toList();

                final List<DeviceControlDataModel> controls = _devicesControls
                    .where((control) => control.device == json['id'])
                    .toList();

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
                      'Missing required channels: "${missingChannels.map((channel) => channel.value).join(", ")}" for device category: "$category" - "${json['id']}".',
                    );
                  }

                  return null;
                }

                final DeviceDataModel device = buildDeviceModel(
                  json,
                  controls,
                  channels
                      .where(
                        (channel) => channelsSpec.all.contains(
                          channel.category,
                        ),
                      )
                      .toList(),
                );

                return device;
              },
            )
            .whereType<DeviceDataModel>()
            .toList(),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices devices: $e');
    }
  }

  Future<void> _loadDevicesControls() async {
    try {
      // Load properties JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/devices_controls.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _devicesControls.clear();
      _devicesControls.addAll(
        jsonList.map(
          (json) => DeviceControlDataModel.fromJson(json),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices controls: $e');
    }
  }

  Future<void> _loadDevicesChannels() async {
    try {
      await _loadChannelsProperties();
      await _loadChannelsControls();

      // Load properties JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channels.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _channels.clear();
      _channels.addAll(
        jsonList
            .map(
              (json) {
                final ChannelCategoryType? category =
                    ChannelCategoryType.fromValue(
                  json['category'],
                );

                if (category == null) {
                  if (kDebugMode) {
                    print(
                        'Unknown channel category: "${json['category']}" for channel: "${json['id']}"');
                  }

                  return null;
                }

                final List<ChannelPropertyDataModel> properties =
                    _channelsProperties
                        .where((property) => property.channel == json['id'])
                        .toList();

                final List<ChannelControlDataModel> controls = _channelsControls
                    .where((control) => control.channel == json['id'])
                    .toList();

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
                      'Missing required properties: "${missingProperties.map((prop) => prop.value).join(", ")}" for channel category: "$category" - "${json['id']}".',
                    );
                  }

                  return null;
                }

                final ChannelDataModel channel = buildChannelModel(
                  json,
                  properties
                      .where(
                        (property) => propertiesSpec.all.contains(
                          property.category,
                        ),
                      )
                      .toList(),
                  controls,
                );

                return channel;
              },
            )
            .whereType<ChannelDataModel>()
            .toList(),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices channels: $e');
    }
  }

  Future<void> _loadChannelsProperties() async {
    try {
      // Load properties JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channel_properties.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _channelsProperties.clear();
      _channelsProperties.addAll(
        jsonList.map(
          (json) => ChannelPropertyDataModel.fromJson(json),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load channels properties: $e');
    }
  }

  Future<void> _loadChannelsControls() async {
    try {
      // Load properties JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channels_controls.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channel property
      _channelsControls.clear();
      _channelsControls.addAll(
        jsonList.map(
          (json) => ChannelControlDataModel.fromJson(json),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load channels controls: $e');
    }
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
}
