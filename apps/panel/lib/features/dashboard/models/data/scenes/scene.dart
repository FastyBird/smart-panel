import 'package:flutter/material.dart';

class SceneDataModel {
  final String _identifier;
  final String _label;
  final String _state;
  bool _isOn;

  SceneDataModel({
    required String identifier,
    required String label,
    required String state,
    bool isOn = false,
  })  : _identifier = identifier,
        _label = label,
        _state = state,
        _isOn = isOn;

  String get identifier => _identifier;

  String get label => _label;

  String get state => _state;

  bool get isOn => _isOn;

  set isOn(bool value) {
    if (_isOn != value) {
      _isOn = value;

      debugPrint('The value has changed to $value');
    }
  }
}
