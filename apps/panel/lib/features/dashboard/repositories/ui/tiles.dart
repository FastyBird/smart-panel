import 'dart:convert';

import 'package:fastybird_smart_panel/features/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class TilesRepository extends ChangeNotifier {
  final List<TileModel> _tiles = [];

  bool _isLoading = true;

  // Simulate initialization with some dummy data
  Future<void> initialize() async {
    _isLoading = true;

    await Future.delayed(const Duration(seconds: 1)); // Simulate a delay

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/tiles.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channels
      _tiles.clear();
      _tiles.addAll(
        jsonList.map(
          (json) => buildTileModel(
            TileType.fromValue(json['type'])!,
            json,
          ),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load tiles: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  TileModel? getById(String id) {
    try {
      return _tiles.firstWhere((tile) => tile.id == id);
    } catch (e) {
      return null;
    }
  }

  List<TileModel> getByIds(List<String> ids) {
    return _tiles.where((tile) => ids.contains(tile.id)).toList();
  }

  List<TileModel> getAll() {
    return _tiles;
  }
}

class TilesDataRepository extends ChangeNotifier {
  final List<TileDataSourceModel> _data = [];

  bool _isLoading = true;

  // Simulate initialization with some dummy data
  Future<void> initialize() async {
    _isLoading = true;

    await Future.delayed(const Duration(seconds: 1)); // Simulate a delay

    try {
      // Load JSON file
      final String jsonString = await rootBundle.loadString(
        'assets/dummy/tiles_data_source.json',
      );

      final List<dynamic> jsonList = jsonDecode(jsonString);

      // Parse and populate channels
      _data.clear();
      _data.addAll(
        jsonList.map(
          (json) => buildTileDataModel(
            TileDataSourceType.fromValue(json['type'])!,
            json,
          ),
        ),
      );
    } catch (e) {
      // Handle errors
      debugPrint('Failed to load tiles data: $e');
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  TileDataSourceModel? getById(String id) {
    try {
      return _data.firstWhere((tile) => tile.id == id);
    } catch (e) {
      return null;
    }
  }

  List<TileDataSourceModel> getByIds(List<String> ids) {
    return _data.where((data) => ids.contains(data.id)).toList();
  }

  List<TileDataSourceModel> getAllForTile(String tile) {
    return _data.where((data) => data.tile == tile).toList();
  }

  List<TileDataSourceModel> getAll() {
    return _data;
  }
}
