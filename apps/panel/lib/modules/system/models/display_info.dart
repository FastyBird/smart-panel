import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class DisplayInfoModel extends Model {
  final int _resolutionX;
  final int _resolutionY;
  final int _currentResX;
  final int _currentResY;

  DisplayInfoModel({
    required int resolutionX,
    required int resolutionY,
    required int currentResX,
    required int currentResY,
  })  : _resolutionX = resolutionX,
        _resolutionY = resolutionY,
        _currentResX = currentResX,
        _currentResY = currentResY;

  int get resolutionX => _resolutionX;

  int get resolutionY => _resolutionY;

  int get currentResX => _currentResX;

  int get currentResY => _currentResY;

  factory DisplayInfoModel.fromJson(Map<String, dynamic> json) {
    return DisplayInfoModel(
      resolutionX: json['resolution_x'],
      resolutionY: json['resolution_y'],
      currentResX: json['current_res_x'],
      currentResY: json['current_res_y'],
    );
  }

  DisplayInfoModel copyWith({
    int? resolutionX,
    int? resolutionY,
    int? currentResX,
    int? currentResY,
  }) {
    return DisplayInfoModel(
      resolutionX: resolutionX ?? _resolutionX,
      resolutionY: resolutionY ?? _resolutionY,
      currentResX: currentResX ?? _currentResX,
      currentResY: currentResY ?? _currentResY,
    );
  }
}
