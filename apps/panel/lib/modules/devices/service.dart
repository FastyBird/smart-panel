import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channel_spec.g.dart';
import 'package:fastybird_smart_panel/spec/device_spec.g.dart';
import 'package:flutter/foundation.dart';

class DevicesService extends ChangeNotifier {
  final DevicesRepository _devicesRepository;
  final ChannelsRepository _channelsRepository;
  final ChannelPropertiesRepository _channelPropertiesRepository;

  Map<String, DeviceView> _devices = {};
  Map<String, ChannelView> _channels = {};
  Map<String, ChannelPropertyView> _properties = {};

  DevicesService({
    required DevicesRepository devicesRepository,
    required ChannelsRepository channelsRepository,
    required ChannelPropertiesRepository channelPropertiesRepository,
  })  : _devicesRepository = devicesRepository,
        _channelsRepository = channelsRepository,
        _channelPropertiesRepository = channelPropertiesRepository;

  Future<void> initialize() async {
    _devicesRepository.addListener(_updateData);
    _channelsRepository.addListener(_updateData);
    _channelPropertiesRepository.addListener(_updateData);

    _updateData();
  }

  Map<String, DeviceView> get devices => _devices;

  Map<String, ChannelView> get channels => _channels;

  Map<String, ChannelPropertyView> get properties => _properties;

  DeviceView? getDevice(String id) {
    if (!_devices.containsKey(id)) {
      return null;
    }

    return _devices[id];
  }

  ChannelView? getChannel(String id) {
    if (!_channels.containsKey(id)) {
      return null;
    }

    return _channels[id];
  }

  ChannelPropertyView? getChannelProperty(String id) {
    if (!_properties.containsKey(id)) {
      return null;
    }

    return _properties[id];
  }

  Future<bool> toggleDeviceOnState(String id) async {
    final DeviceView? device = getDevice(id);

    if (device == null) {
      return false;
    }

    final properties = device.channels
        .expand(
          (channel) => _channelPropertiesRepository.getItems(
            channel.properties
                .map(
                  (property) => property.id,
                )
                .toList(),
          ),
        )
        .where((property) => property.category == ChannelPropertyCategory.on)
        .toList();

    for (var property in properties) {
      if (await _channelPropertiesRepository.toggleValue(property.id) ==
          false) {
        return false;
      }
    }

    return true;
  }

  Future<bool> setPropertyValue(String id, dynamic value) async {
    return await _channelPropertiesRepository.setValue(id, value);
  }

  void _updateData() {
    final devices = _devicesRepository.getItems();
    final channels = _channelsRepository.getItems();
    final channelsProperties = _channelPropertiesRepository.getItems();

    late bool triggerNotifyListeners = false;

    Map<String, ChannelPropertyView> newChannelsPropertiesViews = {};

    for (var property in channelsProperties) {
      try {
        newChannelsPropertiesViews[property.id] = buildChannelPropertyView(
          property,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][SERVICE] Failed to create channel property view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_properties, newChannelsPropertiesViews)) {
      _properties = newChannelsPropertiesViews;

      triggerNotifyListeners = true;
    }

    Map<String, ChannelView> newChannelsViews = {};

    for (var channel in channels) {
      final List<ChannelPropertyView> properties = newChannelsPropertiesViews
          .entries
          .where((entry) => channel.properties.contains(entry.key))
          .map((entry) => entry.value)
          .toList();

      final ChannelPropertiesSpecification propertiesSpec =
          buildChannelPropertiesSpecification(channel.category);

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
            '[DEVICES MODULE][SERVICE] Missing required properties: "${missingProperties.map((prop) => prop.value).join(", ")}" for channel category: "${channel.category.value}" - "${channel.id}".',
          );
        }

        continue;
      }

      try {
        newChannelsViews[channel.id] = buildChannelView(
          channel,
          properties,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][SERVICE] Failed to create channel view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_channels, newChannelsViews)) {
      _channels = newChannelsViews;

      triggerNotifyListeners = true;
    }

    Map<String, DeviceView> newDevicesViews = {};

    for (var device in devices) {
      final List<ChannelView> channels = newChannelsViews.entries
          .where((entry) => device.channels.contains(entry.key))
          .map((entry) => entry.value)
          .toList();

      final DeviceChannelsSpecification channelsSpec =
          buildDeviceChannelsSpecification(device.category);

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
            '[DEVICES MODULE][SERVICE] Missing required channels: "${missingChannels.map((channel) => channel.value).join(", ")}" for device category: "${device.category.value}" - "${device.id}".',
          );
        }

        continue;
      }

      try {
        newDevicesViews[device.id] = buildDeviceView(
          device,
          channels,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][SERVICE] Failed to create device view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_devices, newDevicesViews)) {
      _devices = newDevicesViews;

      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    super.dispose();

    _devicesRepository.removeListener(_updateData);
    _channelsRepository.removeListener(_updateData);
    _channelPropertiesRepository.removeListener(_updateData);
  }
}
