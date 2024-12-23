import 'package:fastybird_smart_panel/features/dashboard/models/data/scenes/scene.dart';
import 'package:flutter/material.dart';

class ScenesDataRepository extends ChangeNotifier {
  final List<SceneDataModel> _scenes = [];

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    // TODO: Dummy data, have to be fetched from backend/configuration
    _scenes.clear();
    _scenes.addAll([
      SceneDataModel(
        identifier: '518574a0-83eb-4b71-bb74-6bc1ba6714c6',
        label: 'Lights',
        state: 'Turned off',
        isOn: false,
      ),
      SceneDataModel(
        identifier: '13b788a8-e1e7-41f4-8e90-ae16f7b972ec',
        label: 'Lock',
        state: 'Unlocked',
        isOn: true,
      ),
    ]);

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  SceneDataModel? getByIdentifier(String identifier) {
    try {
      return _scenes.firstWhere((scene) => scene.identifier == identifier);
    } catch (e) {
      return null;
    }
  }

  // Update the state of a scene and notify listeners
  void toggleState(String identifier) {
    final scene = getByIdentifier(identifier);

    if (scene != null) {
      scene.isOn = !scene.isOn;

      notifyListeners();
    }
  }
}
