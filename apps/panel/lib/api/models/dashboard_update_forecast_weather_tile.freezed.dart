// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_forecast_weather_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateForecastWeatherTile _$DashboardUpdateForecastWeatherTileFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateForecastWeatherTile.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateForecastWeatherTile {
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

  /// Specifies the type of tile as a weather forecast tile.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateForecastWeatherTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateForecastWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateForecastWeatherTileCopyWith<
          DashboardUpdateForecastWeatherTile>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateForecastWeatherTileCopyWith<$Res> {
  factory $DashboardUpdateForecastWeatherTileCopyWith(
          DashboardUpdateForecastWeatherTile value,
          $Res Function(DashboardUpdateForecastWeatherTile) then) =
      _$DashboardUpdateForecastWeatherTileCopyWithImpl<$Res,
          DashboardUpdateForecastWeatherTile>;
  @useResult
  $Res call(
      {int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class _$DashboardUpdateForecastWeatherTileCopyWithImpl<$Res,
        $Val extends DashboardUpdateForecastWeatherTile>
    implements $DashboardUpdateForecastWeatherTileCopyWith<$Res> {
  _$DashboardUpdateForecastWeatherTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateForecastWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateForecastWeatherTileImplCopyWith<$Res>
    implements $DashboardUpdateForecastWeatherTileCopyWith<$Res> {
  factory _$$DashboardUpdateForecastWeatherTileImplCopyWith(
          _$DashboardUpdateForecastWeatherTileImpl value,
          $Res Function(_$DashboardUpdateForecastWeatherTileImpl) then) =
      __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl<$Res>
    extends _$DashboardUpdateForecastWeatherTileCopyWithImpl<$Res,
        _$DashboardUpdateForecastWeatherTileImpl>
    implements _$$DashboardUpdateForecastWeatherTileImplCopyWith<$Res> {
  __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl(
      _$DashboardUpdateForecastWeatherTileImpl _value,
      $Res Function(_$DashboardUpdateForecastWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateForecastWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? type = null,
  }) {
    return _then(_$DashboardUpdateForecastWeatherTileImpl(
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdateForecastWeatherTileImpl
    implements _DashboardUpdateForecastWeatherTile {
  const _$DashboardUpdateForecastWeatherTileImpl(
      {required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      this.type = 'weather-forecast'});

  factory _$DashboardUpdateForecastWeatherTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardUpdateForecastWeatherTileImplFromJson(json);

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

  /// Specifies the type of tile as a weather forecast tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardUpdateForecastWeatherTile(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateForecastWeatherTileImpl &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, row, col, rowSpan, colSpan, type);

  /// Create a copy of DashboardUpdateForecastWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateForecastWeatherTileImplCopyWith<
          _$DashboardUpdateForecastWeatherTileImpl>
      get copyWith => __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl<
          _$DashboardUpdateForecastWeatherTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateForecastWeatherTileImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateForecastWeatherTile
    implements DashboardUpdateForecastWeatherTile {
  const factory _DashboardUpdateForecastWeatherTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      final String type}) = _$DashboardUpdateForecastWeatherTileImpl;

  factory _DashboardUpdateForecastWeatherTile.fromJson(
          Map<String, dynamic> json) =
      _$DashboardUpdateForecastWeatherTileImpl.fromJson;

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

  /// Specifies the type of tile as a weather forecast tile.
  @override
  String get type;

  /// Create a copy of DashboardUpdateForecastWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateForecastWeatherTileImplCopyWith<
          _$DashboardUpdateForecastWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
