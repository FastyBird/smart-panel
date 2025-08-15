import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class DisplayProfileModel extends Model {
  final String _id;
  final String _uid;
  final int _screenWidth;
  final int _screenHeight;
  final double _pixelRatio;
  final double _unitSize;
  final int _rows;
  final int _cols;
  final bool _primary;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  DisplayProfileModel({
    required String id,
    required String uid,
    required int screenWidth,
    required int screenHeight,
    required double pixelRatio,
    required double unitSize,
    required int rows,
    required int cols,
    required bool primary,
    required DateTime? createdAt,
    required DateTime? updatedAt,
  })  : _id = id,
        _uid = uid,
        _screenWidth = screenWidth,
        _screenHeight = screenHeight,
        _pixelRatio = pixelRatio,
        _unitSize = unitSize,
        _rows = rows,
        _cols = cols,
        _primary = primary,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  String get uid => _uid;

  int get screenWidth => _screenWidth;

  int get screenHeight => _screenHeight;

  double get pixelRatio => _pixelRatio;

  double get unitSize => _unitSize;

  int get rows => _rows;

  int get cols => _cols;

  bool get primary => _primary;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  factory DisplayProfileModel.fromJson(Map<String, dynamic> json) {
    return DisplayProfileModel(
      id: json['id'],
      uid: json['uid'],
      screenWidth: json['screen_width'],
      screenHeight: json['screen_height'],
      pixelRatio: json['pixel_ratio'],
      unitSize: json['unit_size'].toDouble(),
      rows: json['rows'],
      cols: json['cols'],
      primary: json['primary'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DisplayProfileModel &&
          other._screenWidth == _screenWidth &&
          other._screenHeight == _screenHeight &&
          other._pixelRatio == _pixelRatio &&
          other._unitSize == _unitSize &&
          other._rows == _rows &&
          other._cols == _cols &&
          other._primary == _primary);

  @override
  int get hashCode => Object.hashAll([
        _screenWidth,
        _screenHeight,
        _pixelRatio,
        _unitSize,
        _rows,
        _cols,
        _primary,
      ]);
}
