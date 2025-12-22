import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/foundation.dart';

class DevicesService extends ChangeNotifier {
  final DevicesRepository _devicesRepository;
  final DeviceControlsRepository _devicesControlsRepository;
  final ChannelsRepository _channelsRepository;
  final ChannelPropertiesRepository _channelPropertiesRepository;
  final ChannelControlsRepository _channelControlsRepository;
  final DeviceValidationRepository _validationRepository;

  Map<String, DeviceView> _devices = {};
  Map<String, ChannelView> _channels = {};
  Map<String, ChannelPropertyView> _properties = {};

  DevicesService({
    required DevicesRepository devicesRepository,
    required DeviceControlsRepository devicesControlsRepository,
    required ChannelsRepository channelsRepository,
    required ChannelPropertiesRepository channelPropertiesRepository,
    required ChannelControlsRepository channelControlsRepository,
    required DeviceValidationRepository validationRepository,
  })  : _devicesRepository = devicesRepository,
        _devicesControlsRepository = devicesControlsRepository,
        _channelsRepository = channelsRepository,
        _channelPropertiesRepository = channelPropertiesRepository,
        _channelControlsRepository = channelControlsRepository,
        _validationRepository = validationRepository;

  Future<void> initialize() async {
    await _devicesRepository.fetchAll();

    for (var device in _devicesRepository.getItems()) {
      await _devicesControlsRepository.fetchAll(device.id);
    }

    await _channelsRepository.fetchAll();

    for (var channel in _channelsRepository.getItems()) {
      await _channelPropertiesRepository.fetchAll(channel.id);
      await _channelControlsRepository.fetchAll(channel.id);
    }

    await _validationRepository.fetchAll();

    _devicesRepository.addListener(_updateData);
    _channelsRepository.addListener(_updateData);
    _channelPropertiesRepository.addListener(_updateData);
    _validationRepository.addListener(_updateData);

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

    // First pass: create basic channel views (properties only, no validation yet)
    Map<String, ChannelView> newChannelsViews = {};

    for (var channel in channels) {
      final List<ChannelPropertyView> properties = newChannelsPropertiesViews
          .entries
          .where((entry) => channel.properties.contains(entry.key))
          .map((entry) => entry.value)
          .toList();

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

    Map<String, DeviceView> newDevicesViews = {};

    for (var device in devices) {
      final List<ChannelView> deviceChannels = newChannelsViews.entries
          .where((entry) => device.channels.contains(entry.key))
          .map((entry) => entry.value)
          .toList();

      // Get validation result for this device
      final validationResult = _validationRepository.getForDevice(device.id);
      final isValid = validationResult?.isValid ?? true;
      final deviceIssues = validationResult?.issues
              .where((issue) => issue.channelId == null)
              .toList() ??
          [];

      // Create validated channel views and update the global map
      final List<ChannelView> channelsWithValidation =
          deviceChannels.map((channel) {
        final channelIssues =
            _validationRepository.getIssuesForChannel(device.id, channel.id);
        final channelIsValid = !channelIssues.any((issue) => issue.isError);

        final validatedChannel = buildChannelView(
          channel.channelModel,
          channel.properties,
          isValid: channelIsValid,
          validationIssues: channelIssues,
        );

        // Update the global channels map with validated version
        newChannelsViews[channel.id] = validatedChannel;

        return validatedChannel;
      }).toList();

      try {
        newDevicesViews[device.id] = buildDeviceView(
          device,
          channelsWithValidation,
          isValid: isValid,
          validationIssues: deviceIssues,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][SERVICE] Failed to create device view: ${e.toString()}',
          );
        }
      }
    }

    // Update channels after all devices processed (includes validation)
    if (!mapEquals(_channels, newChannelsViews)) {
      _channels = newChannelsViews;

      triggerNotifyListeners = true;
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
    _validationRepository.removeListener(_updateData);
  }
}
