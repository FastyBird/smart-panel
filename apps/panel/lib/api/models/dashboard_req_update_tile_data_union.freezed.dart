// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdateTileDataUnion _$DashboardReqUpdateTileDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardUpdateDeviceTile.fromJson(json);
    case 'clock':
      return DashboardUpdateTimeTile.fromJson(json);
    case 'weather-day':
      return DashboardUpdateDayWeatherTile.fromJson(json);
    case 'weather-forecast':
      return DashboardUpdateForecastWeatherTile.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqUpdateTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqUpdateTileDataUnion {
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

  /// Indicates that this is a device-specific dashboard tile.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardUpdateDeviceTile value) device,
    required TResult Function(DashboardUpdateTimeTile value) clock,
    required TResult Function(DashboardUpdateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardUpdateForecastWeatherTile value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateDeviceTile value)? device,
    TResult? Function(DashboardUpdateTimeTile value)? clock,
    TResult? Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardUpdateForecastWeatherTile value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateDeviceTile value)? device,
    TResult Function(DashboardUpdateTimeTile value)? clock,
    TResult Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardUpdateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdateTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdateTileDataUnionCopyWith<DashboardReqUpdateTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory $DashboardReqUpdateTileDataUnionCopyWith(
          DashboardReqUpdateTileDataUnion value,
          $Res Function(DashboardReqUpdateTileDataUnion) then) =
      _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
          DashboardReqUpdateTileDataUnion>;
  @useResult
  $Res call(
      {int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqUpdateTileDataUnion>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  _$DashboardReqUpdateTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdateTileDataUnion
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
abstract class _$$DashboardUpdateDeviceTileImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
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
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateDeviceTileImpl>
    implements _$$DashboardUpdateDeviceTileImplCopyWith<$Res> {
  __$$DashboardUpdateDeviceTileImplCopyWithImpl(
      _$DashboardUpdateDeviceTileImpl _value,
      $Res Function(_$DashboardUpdateDeviceTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
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
class _$DashboardUpdateDeviceTileImpl implements DashboardUpdateDeviceTile {
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
    return 'DashboardReqUpdateTileDataUnion.device(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, device: $device, icon: $icon, type: $type)';
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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDeviceTileImplCopyWith<_$DashboardUpdateDeviceTileImpl>
      get copyWith => __$$DashboardUpdateDeviceTileImplCopyWithImpl<
          _$DashboardUpdateDeviceTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return device(row, col, rowSpan, colSpan, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
  }) {
    return device?.call(row, col, rowSpan, colSpan, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(row, col, rowSpan, colSpan, this.device, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardUpdateDeviceTile value) device,
    required TResult Function(DashboardUpdateTimeTile value) clock,
    required TResult Function(DashboardUpdateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardUpdateForecastWeatherTile value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateDeviceTile value)? device,
    TResult? Function(DashboardUpdateTimeTile value)? clock,
    TResult? Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardUpdateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateDeviceTile value)? device,
    TResult Function(DashboardUpdateTimeTile value)? clock,
    TResult Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardUpdateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDeviceTileImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateDeviceTile
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardUpdateDeviceTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardUpdateDeviceTileImpl;

  factory DashboardUpdateDeviceTile.fromJson(Map<String, dynamic> json) =
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
  String get device;

  /// The icon representing the tile.
  String? get icon;

  /// Indicates that this is a device-specific dashboard tile.
  @override
  String get type;

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDeviceTileImplCopyWith<_$DashboardUpdateDeviceTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardUpdateTimeTileImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardUpdateTimeTileImplCopyWith(
          _$DashboardUpdateTimeTileImpl value,
          $Res Function(_$DashboardUpdateTimeTileImpl) then) =
      __$$DashboardUpdateTimeTileImplCopyWithImpl<$Res>;
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
class __$$DashboardUpdateTimeTileImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateTimeTileImpl>
    implements _$$DashboardUpdateTimeTileImplCopyWith<$Res> {
  __$$DashboardUpdateTimeTileImplCopyWithImpl(
      _$DashboardUpdateTimeTileImpl _value,
      $Res Function(_$DashboardUpdateTimeTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
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
    return _then(_$DashboardUpdateTimeTileImpl(
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
class _$DashboardUpdateTimeTileImpl implements DashboardUpdateTimeTile {
  const _$DashboardUpdateTimeTileImpl(
      {required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      this.type = 'clock'});

  factory _$DashboardUpdateTimeTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateTimeTileImplFromJson(json);

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

  /// Specifies the type of tile as a clock.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.clock(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateTimeTileImpl &&
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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateTimeTileImplCopyWith<_$DashboardUpdateTimeTileImpl>
      get copyWith => __$$DashboardUpdateTimeTileImplCopyWithImpl<
          _$DashboardUpdateTimeTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return clock(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
  }) {
    return clock?.call(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(row, col, rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardUpdateDeviceTile value) device,
    required TResult Function(DashboardUpdateTimeTile value) clock,
    required TResult Function(DashboardUpdateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardUpdateForecastWeatherTile value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateDeviceTile value)? device,
    TResult? Function(DashboardUpdateTimeTile value)? clock,
    TResult? Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardUpdateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateDeviceTile value)? device,
    TResult Function(DashboardUpdateTimeTile value)? clock,
    TResult Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardUpdateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateTimeTileImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateTimeTile
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardUpdateTimeTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      final String type}) = _$DashboardUpdateTimeTileImpl;

  factory DashboardUpdateTimeTile.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateTimeTileImpl.fromJson;

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

  /// Specifies the type of tile as a clock.
  @override
  String get type;

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateTimeTileImplCopyWith<_$DashboardUpdateTimeTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardUpdateDayWeatherTileImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardUpdateDayWeatherTileImplCopyWith(
          _$DashboardUpdateDayWeatherTileImpl value,
          $Res Function(_$DashboardUpdateDayWeatherTileImpl) then) =
      __$$DashboardUpdateDayWeatherTileImplCopyWithImpl<$Res>;
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
class __$$DashboardUpdateDayWeatherTileImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateDayWeatherTileImpl>
    implements _$$DashboardUpdateDayWeatherTileImplCopyWith<$Res> {
  __$$DashboardUpdateDayWeatherTileImplCopyWithImpl(
      _$DashboardUpdateDayWeatherTileImpl _value,
      $Res Function(_$DashboardUpdateDayWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
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
    return _then(_$DashboardUpdateDayWeatherTileImpl(
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
class _$DashboardUpdateDayWeatherTileImpl
    implements DashboardUpdateDayWeatherTile {
  const _$DashboardUpdateDayWeatherTileImpl(
      {required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      this.type = 'weather-day'});

  factory _$DashboardUpdateDayWeatherTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardUpdateDayWeatherTileImplFromJson(json);

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

  /// Specifies the type of tile as a day weather tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.weatherDay(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateDayWeatherTileImpl &&
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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateDayWeatherTileImplCopyWith<
          _$DashboardUpdateDayWeatherTileImpl>
      get copyWith => __$$DashboardUpdateDayWeatherTileImplCopyWithImpl<
          _$DashboardUpdateDayWeatherTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return weatherDay(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
  }) {
    return weatherDay?.call(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(row, col, rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardUpdateDeviceTile value) device,
    required TResult Function(DashboardUpdateTimeTile value) clock,
    required TResult Function(DashboardUpdateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardUpdateForecastWeatherTile value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateDeviceTile value)? device,
    TResult? Function(DashboardUpdateTimeTile value)? clock,
    TResult? Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardUpdateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateDeviceTile value)? device,
    TResult Function(DashboardUpdateTimeTile value)? clock,
    TResult Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardUpdateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateDayWeatherTileImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateDayWeatherTile
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardUpdateDayWeatherTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      final String type}) = _$DashboardUpdateDayWeatherTileImpl;

  factory DashboardUpdateDayWeatherTile.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateDayWeatherTileImpl.fromJson;

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

  /// Specifies the type of tile as a day weather tile.
  @override
  String get type;

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateDayWeatherTileImplCopyWith<
          _$DashboardUpdateDayWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardUpdateForecastWeatherTileImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
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
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardUpdateForecastWeatherTileImpl>
    implements _$$DashboardUpdateForecastWeatherTileImplCopyWith<$Res> {
  __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl(
      _$DashboardUpdateForecastWeatherTileImpl _value,
      $Res Function(_$DashboardUpdateForecastWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
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
    implements DashboardUpdateForecastWeatherTile {
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
    return 'DashboardReqUpdateTileDataUnion.weatherForecast(row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateForecastWeatherTileImplCopyWith<
          _$DashboardUpdateForecastWeatherTileImpl>
      get copyWith => __$$DashboardUpdateForecastWeatherTileImplCopyWithImpl<
          _$DashboardUpdateForecastWeatherTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return weatherForecast(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult? Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
  }) {
    return weatherForecast?.call(row, col, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        clock,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherDay,
    TResult Function(int row, int col, @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan, String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(row, col, rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardUpdateDeviceTile value) device,
    required TResult Function(DashboardUpdateTimeTile value) clock,
    required TResult Function(DashboardUpdateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardUpdateForecastWeatherTile value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardUpdateDeviceTile value)? device,
    TResult? Function(DashboardUpdateTimeTile value)? clock,
    TResult? Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardUpdateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardUpdateDeviceTile value)? device,
    TResult Function(DashboardUpdateTimeTile value)? clock,
    TResult Function(DashboardUpdateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardUpdateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateForecastWeatherTileImplToJson(
      this,
    );
  }
}

abstract class DashboardUpdateForecastWeatherTile
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardUpdateForecastWeatherTile(
      {required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      final String type}) = _$DashboardUpdateForecastWeatherTileImpl;

  factory DashboardUpdateForecastWeatherTile.fromJson(
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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateForecastWeatherTileImplCopyWith<
          _$DashboardUpdateForecastWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
