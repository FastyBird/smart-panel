import 'dart:convert';

import 'package:fastybird_smart_panel/features/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PagesRepository extends ChangeNotifier {
  final List<PageModel> _pages = [];

  bool _isLoading = true;

  // Simulate initialization with some dummy data
  Future<void> initialize() async {
    _isLoading = true;

    await Future.delayed(const Duration(seconds: 1)); // Simulate a delay

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/pages.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channels
      _pages.clear();
      _pages.addAll(
        jsonList.map(
          (json) => buildPageModel(
            PageType.fromValue(json['type'])!,
            json,
          ),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load pages: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  PageModel? getById(String id) {
    try {
      return _pages.firstWhere((page) => page.id == id);
    } catch (e) {
      return null;
    }
  }

  List<PageModel> getAll() {
    return _pages..sort((a, b) => a.order.compareTo(b.order));
  }
}
