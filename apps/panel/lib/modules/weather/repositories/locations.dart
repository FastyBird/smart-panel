import 'package:fastybird_smart_panel/modules/weather/models/location.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

typedef PrimaryLocationIdProvider = String? Function();

class LocationsRepository extends Repository<List<WeatherLocationModel>> {
  String? _selectedLocationId;
  PrimaryLocationIdProvider? _primaryLocationIdProvider;

  LocationsRepository({required super.apiClient}) {
    data = [];
  }

  /// Set a function to provide the primary location ID from config
  void setPrimaryLocationIdProvider(PrimaryLocationIdProvider provider) {
    _primaryLocationIdProvider = provider;
  }

  /// Get the primary location ID from config
  String? get primaryLocationId => _primaryLocationIdProvider?.call();

  /// Get all locations
  List<WeatherLocationModel> get locations => data ?? [];

  /// Get selected location ID
  String? get selectedLocationId => _selectedLocationId;

  /// Get selected location
  WeatherLocationModel? get selectedLocation {
    if (_selectedLocationId == null || data == null) return null;
    try {
      return data!.firstWhere((loc) => loc.id == _selectedLocationId);
    } catch (_) {
      return data!.isNotEmpty ? data!.first : null;
    }
  }

  /// Select a location by ID
  void selectLocation(String? locationId) {
    if (_selectedLocationId != locationId) {
      _selectedLocationId = locationId;
      notifyListeners();
    }
  }

  /// Fetch all locations from the backend
  /// Note: Locations are primarily populated via socket events.
  /// This method is kept for compatibility but currently does nothing.
  Future<void> fetchLocations() async {
    // Locations are populated through socket events rather than a dedicated API endpoint.
    // The weather module sends location data when weather updates are received.
    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE][LOCATIONS] fetchLocations called - locations are populated via socket events',
      );
    }
  }

  /// Insert locations from raw JSON list
  void insertLocations(List<Map<String, dynamic>> jsonList) {
    try {
      final newData = jsonList
          .map((json) => WeatherLocationModel.fromJson(json))
          .toList();

      if (!listEquals(data, newData)) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][LOCATIONS] Locations updated: ${newData.length} locations',
          );
        }

        data = newData;

        // Auto-select location if none selected
        if (_selectedLocationId == null && newData.isNotEmpty) {
          // Prefer primary location from config, fall back to first location
          final primaryId = primaryLocationId;
          if (primaryId != null && newData.any((loc) => loc.id == primaryId)) {
            _selectedLocationId = primaryId;
            if (kDebugMode) {
              debugPrint(
                '[WEATHER MODULE][LOCATIONS] Auto-selected primary location: $primaryId',
              );
            }
          } else {
            _selectedLocationId = newData.first.id;
            if (kDebugMode) {
              debugPrint(
                '[WEATHER MODULE][LOCATIONS] Auto-selected first location: ${newData.first.id}',
              );
            }
          }
        }

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][LOCATIONS] Failed to parse locations: ${e.toString()}',
        );
      }
    }
  }

  /// Insert or update a single location
  void insertLocation(Map<String, dynamic> json) {
    try {
      final location = WeatherLocationModel.fromJson(json);
      final currentList = List<WeatherLocationModel>.from(data ?? []);

      final existingIndex = currentList.indexWhere((l) => l.id == location.id);

      if (existingIndex >= 0) {
        currentList[existingIndex] = location;
      } else {
        currentList.add(location);
      }

      if (!listEquals(data, currentList)) {
        data = currentList;

        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][LOCATIONS] Location ${existingIndex >= 0 ? "updated" : "added"}: ${location.id}',
          );
        }

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][LOCATIONS] Failed to insert location: ${e.toString()}',
        );
      }
    }
  }

  /// Remove a location by ID
  void removeLocation(String locationId) {
    final currentList = List<WeatherLocationModel>.from(data ?? []);
    final initialLength = currentList.length;

    currentList.removeWhere((l) => l.id == locationId);

    if (currentList.length != initialLength) {
      data = currentList;

      // If removed location was selected, select another
      if (_selectedLocationId == locationId) {
        _selectedLocationId = currentList.isNotEmpty ? currentList.first.id : null;
      }

      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][LOCATIONS] Location removed: $locationId',
        );
      }

      notifyListeners();
    }
  }

  /// Refresh locations from backend
  Future<bool> refresh() async {
    try {
      await fetchLocations();
      return true;
    } catch (e) {
      return false;
    }
  }
}
