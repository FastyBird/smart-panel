import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
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
    // Fetch devices - embedded channels and properties are auto-extracted
    await _devicesRepository.fetchAll();

    // Fetch device controls (not embedded in device response)
    for (var device in _devicesRepository.getItems()) {
      await _devicesControlsRepository.fetchAll(device.id);
    }

    // Fetch channel controls (not embedded in channel response)
    for (var channel in _channelsRepository.getItems()) {
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

  List<DeviceView> get devicesList => _devices.values.toList();

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

  /// Get all devices assigned to a specific room
  List<DeviceView> getDevicesForRoom(String roomId) {
    return _devices.values.where((d) => d.roomId == roomId).toList();
  }

  /// Get all devices assigned to a specific zone
  List<DeviceView> getDevicesForZone(String zoneId) {
    return _devices.values.where((d) => d.zoneIds.contains(zoneId)).toList();
  }

  /// Get all devices of a specific category
  List<DeviceView> getDevicesByCategory(DevicesModuleDeviceCategory category) {
    return _devices.values.where((d) => d.category == category).toList();
  }

  /// Get all devices matching any of the specified categories
  List<DeviceView> getDevicesByCategories(List<DevicesModuleDeviceCategory> categories) {
    return _devices.values
        .where((d) => categories.contains(d.category))
        .toList();
  }

  /// Get devices for a room filtered by category
  List<DeviceView> getDevicesForRoomByCategory(
    String roomId,
    DevicesModuleDeviceCategory category,
  ) {
    return _devices.values
        .where((d) => d.roomId == roomId && d.category == category)
        .toList();
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
        .where((property) => property.category == DevicesModulePropertyCategory.valueOn)
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

  /// Set a single property value with context
  /// This wraps setMultiplePropertyValues for convenience
  Future<bool> setPropertyValueWithContext({
    required String deviceId,
    required String channelId,
    required String propertyId,
    required dynamic value,
    PropertyCommandContext? context,
  }) async {
    return await _channelPropertiesRepository.setMultipleValues(
      properties: [
        PropertyCommandItem(
          deviceId: deviceId,
          channelId: channelId,
          propertyId: propertyId,
          value: value,
        ),
      ],
      context: context,
    );
  }

  /// Set multiple property values in a single command
  /// This creates a single intent on the backend for all properties
  Future<bool> setMultiplePropertyValues({
    required List<PropertyCommandItem> properties,
    PropertyCommandContext? context,
  }) async {
    return await _channelPropertiesRepository.setMultipleValues(
      properties: properties,
      context: context,
    );
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

        // Get the channel model from the repository to rebuild with validation
        final channelModel = _channelsRepository.getItem(channel.id);
        if (channelModel == null) {
          return channel; // Fallback to the existing channel view
        }

        final validatedChannel = buildChannelView(
          channelModel,
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
