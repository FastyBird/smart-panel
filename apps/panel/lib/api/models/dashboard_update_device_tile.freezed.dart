// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_device_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateDeviceTile _$DashboardUpdateDeviceTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateDeviceTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateDeviceTile {
  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The icon representing the tile.
  String? get icon => throw _privateConstructorUsedError;

  /// Indicates that this is a device-specific dashboard tile.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateDeviceTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateDeviceTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateDeviceTileCopyWith<DashboardUpdateDeviceTile> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateDeviceTileCopyWith<$Res> {
  factory $DashboardUpdateDeviceTileCopyWith(DashboardUpdateDeviceTile value,
          $Res Function(DashboardUpdateDeviceTile) then) =
      _$DashboardUpdateDeviceTileCopyWithImpl<$Res, DashboardUpdateDeviceTile>;
  @useResult
  $Res call(
      {int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String device,
      String? icon,
      String type});
}

/// @nodoc
class _$DashboardUpdateDeviceTileCopyWithImpl<$Res,
        $Val extends DashboardUpdateDeviceTile>
    implements $DashboardUpdateDeviceTileCopyWith<$Res> {
  _$DashboardUpdateDeviceTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateDeviceTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? device = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateDeviceTileImplCopyWith<$Res>
    implements $DashboardUpdateDeviceTileCopyWith<$Res> {
  factory _$$DashboardUpdateDeviceTileImplCopyWith(
          _$DashboardUpdateDeviceTileImpl value,
          $Res Function(_$DashboardUpdateDeviceTileImpl) then) =
      __$$DashboardUpdateDeviceTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String device,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardUpdateDeviceTileImplCopyWithImpl<$Res>
    extends _$DashboardUpdateDeviceTileCopyWithImpl<$Res,
        _$DashboardUpdateDeviceTileImpl>
    implements _$$DashboardUpdateDeviceTileImplCopyWith<$Res> {
  __$$DashboardUpdateDeviceTileImplCopyWithImpl(
      _$DashboardUpdateDeviceTileImpl _value,
      $Res Function(_$DashboardUpdateDeviceTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateDeviceTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? device = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardUpdateDeviceTileImpl(
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdateDeviceTileImpl implements _DashboardUpdateDeviceTile {
  const _$DashboardUpdateDeviceTileImpl(
      {required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      required this.device,
      this.icon,
      this.type = 'device'});

  factory _$DashboardUpdateDeviceTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateDeviceTileImplFromJson(json);

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the tile.
  @override
  final String? icon;

  /// Indicates that this is a device-specific dashboard tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardUpdateDeviceTile(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, device: $device, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateDeviceTileImpl &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, row, col, rowSpan, colSpan, device, icon, type);

  /// Create a copy of DashboardUpdateDeviceTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDeviceTileImplCopyWith<_$DashboardUpdateDeviceTileImpl>
      get copyWith => __$$DashboardUpdateDeviceTileImplCopyWithImpl<
          _$DashboardUpdateDeviceTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDeviceTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateDeviceTile implements DashboardUpdateDeviceTile {
  const factory _DashboardUpdateDeviceTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardUpdateDeviceTileImpl;

  factory _DashboardUpdateDeviceTile.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateDeviceTileImpl.fromJson;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The icon representing the tile.
  @override
  String? get icon;

  /// Indicates that this is a device-specific dashboard tile.
  @override
  String get type;

  /// Create a copy of DashboardUpdateDeviceTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDeviceTileImplCopyWith<_$DashboardUpdateDeviceTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
