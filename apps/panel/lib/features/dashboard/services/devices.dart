import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/export.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/foundation.dart';

class DevicesService extends ChangeNotifier {
  final DevicesRepository _devicesRepository;
  final ChannelsRepository _channelsRepository;
  final ChannelPropertiesRepository _channelPropertiesRepository;

  Map<String, DeviceType> _devices = {};

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

  Map<String, DeviceType> get devices => _devices;

  DeviceType? getDevice(String id) {
    if (!_devices.containsKey(id)) {
      return null;
    }

    return _devices[id];
  }

  Future<bool> toggleDeviceOnState(String id) async {
    final DeviceType? device = getDevice(id);

    if (device == null) {
      return false;
    }

    final properties = device.capabilities
        .expand(
          (channel) => _channelPropertiesRepository.getItems(
            channel.properties
                .map(
                  (property) => property.id,
                )
                .toList(),
          ),
        )
        .where((property) => property.category == PropertyCategory.on)
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

    Map<String, DeviceType> newCapabilities = {};

    for (var device in devices) {
      final channels = _channelsRepository.getItems(device.channels);

      List<Capability> channelCapabilities = [];

      for (var channel in channels) {
        final properties = _channelPropertiesRepository.getItems(
          channel.properties,
        );

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
              'Missing required properties: "${missingProperties.map((prop) => prop.value).join(", ")}" for channel category: "${channel.category.value}" - "${channel.id}".',
            );
          }

          continue;
        }

        channelCapabilities.add(
          buildChannelCapability(
            channel,
            properties,
          ),
        );
      }

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
            'Missing required channels: "${missingChannels.map((channel) => channel.value).join(", ")}" for device category: "${device.category.value}" - "${device.id}".',
          );
        }

        continue;
      }

      newCapabilities[device.id] = buildDeviceType(
        device,
        channelCapabilities,
      );
    }

    if (!mapEquals(_devices, newCapabilities)) {
      _devices = newCapabilities;

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
