import 'dart:convert';

import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ChannelsDataRepository extends ChangeNotifier {
  final List<ChannelDataModel> _channels = [];

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/channels.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate devices
      _channels.clear();
      _channels.addAll(
        jsonList.map((json) => ChannelDataModel.fromJson(json)),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load channels: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  ChannelDataModel? getById(String id) {
    try {
      return _channels.firstWhere((device) => device.id == id);
    } catch (e) {
      return null;
    }
  }

  List<ChannelDataModel> getForDevice(String deviceId) {
    return _channels.where((property) => property.device == deviceId).toList();
  }

  List<ChannelDataModel> getAll() {
    return _channels;
  }
}
