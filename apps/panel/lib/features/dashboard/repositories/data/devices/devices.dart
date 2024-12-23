import 'dart:convert';

import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DevicesDataRepository extends ChangeNotifier {
  final List<DeviceDataModel> _devices = [];

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/devices.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate devices
      _devices.clear();
      _devices.addAll(
        jsonList.map((json) => DeviceDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load devices: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  DeviceDataModel? getById(String id) {
    try {
      return _devices.firstWhere((device) => device.id == id);
    } catch (e) {
      return null;
    }
  }

  List<DeviceDataModel> getAll() {
    return _devices;
  }
}
