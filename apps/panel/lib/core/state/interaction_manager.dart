import 'package:flutter/material.dart';

class InteractionManager extends ChangeNotifier {
  bool _isInteracting = false;

  bool get isInteracting => _isInteracting;

  void startInteraction() {
    if (!_isInteracting) {
      _isInteracting = true;

      notifyListeners();
    }
  }

  void stopInteraction() {
    if (_isInteracting) {
      _isInteracting = false;

      notifyListeners();
    }
  }
}
