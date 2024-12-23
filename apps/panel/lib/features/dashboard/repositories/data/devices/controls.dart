import 'dart:convert';

import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DevicesControlsDataRepository
    extends ControlsDataRepository<DeviceControlDataModel> {
  @override
  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/devices_controls.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate devices controls
      _controls.clear();
      _controls.addAll(
        jsonList.map((json) => DeviceControlDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices controls: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  List<DeviceControlDataModel> getForDevice(String deviceId) {
    return _controls.where((control) => control.device == deviceId).toList();
  }
}

class ChannelsControlsDataRepository
    extends ControlsDataRepository<ChannelControlDataModel> {
  @override
  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channels_controls.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channels controls
      _controls.clear();
      _controls.addAll(
        jsonList.map((json) => ChannelControlDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load channels controls: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  List<ChannelControlDataModel> getForChannel(String channelId) {
    return _controls.where((control) => control.channel == channelId).toList();
  }
}

abstract class ControlsDataRepository<T extends ControlDataModel>
    extends ChangeNotifier {
  final List<T> _controls = [];

  bool _isLoading = true;

  initialize();

  bool get isLoading => _isLoading;

  T? getById(String id) {
    try {
      return _controls.firstWhere((channel) => channel.id == id);
    } catch (e) {
      return null;
    }
  }

  List<T> getAll() {
    return _controls;
  }
}
