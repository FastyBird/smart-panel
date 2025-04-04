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
    case 'device-preview':
      return DashboardReqUpdateTileDataUnionDevicePreview.fromJson(json);
    case 'clock':
      return DashboardReqUpdateTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardReqUpdateTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardReqUpdateTileDataUnionWeatherForecast.fromJson(json);

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
  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

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
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)
        devicePreview,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqUpdateTileDataUnionClock value) clock,
    required TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqUpdateTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
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
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
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
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWith(
          _$DashboardReqUpdateTileDataUnionDevicePreviewImpl value,
          $Res Function(_$DashboardReqUpdateTileDataUnionDevicePreviewImpl)
              then) =
      __$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String device,
      String? icon});
}

/// @nodoc
class __$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdateTileDataUnionDevicePreviewImpl>
    implements
        _$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWith<$Res> {
  __$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWithImpl(
      _$DashboardReqUpdateTileDataUnionDevicePreviewImpl _value,
      $Res Function(_$DashboardReqUpdateTileDataUnionDevicePreviewImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? device = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdateTileDataUnionDevicePreviewImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateTileDataUnionDevicePreviewImpl
    implements DashboardReqUpdateTileDataUnionDevicePreview {
  const _$DashboardReqUpdateTileDataUnionDevicePreviewImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      required this.device,
      this.icon});

  factory _$DashboardReqUpdateTileDataUnionDevicePreviewImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateTileDataUnionDevicePreviewImplFromJson(json);

  /// Discriminator for the tile type
  @override
  final String type;

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

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.devicePreview(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, device: $device, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateTileDataUnionDevicePreviewImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan, device, icon);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardReqUpdateTileDataUnionDevicePreviewImpl>
      get copyWith =>
          __$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWithImpl<
                  _$DashboardReqUpdateTileDataUnionDevicePreviewImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)
        devicePreview,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return devicePreview(type, row, col, rowSpan, colSpan, device, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return devicePreview?.call(type, row, col, rowSpan, colSpan, device, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(type, row, col, rowSpan, colSpan, device, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqUpdateTileDataUnionClock value) clock,
    required TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqUpdateTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return devicePreview(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return devicePreview?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateTileDataUnionDevicePreviewImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdateTileDataUnionDevicePreview
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardReqUpdateTileDataUnionDevicePreview(
      {required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      required final String device,
      final String? icon}) = _$DashboardReqUpdateTileDataUnionDevicePreviewImpl;

  factory DashboardReqUpdateTileDataUnionDevicePreview.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdateTileDataUnionDevicePreviewImpl.fromJson;

  /// Discriminator for the tile type
  @override
  String get type;

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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardReqUpdateTileDataUnionDevicePreviewImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdateTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdateTileDataUnionClockImplCopyWith(
          _$DashboardReqUpdateTileDataUnionClockImpl value,
          $Res Function(_$DashboardReqUpdateTileDataUnionClockImpl) then) =
      __$$DashboardReqUpdateTileDataUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqUpdateTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdateTileDataUnionClockImpl>
    implements _$$DashboardReqUpdateTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardReqUpdateTileDataUnionClockImplCopyWithImpl(
      _$DashboardReqUpdateTileDataUnionClockImpl _value,
      $Res Function(_$DashboardReqUpdateTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqUpdateTileDataUnionClockImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateTileDataUnionClockImpl
    implements DashboardReqUpdateTileDataUnionClock {
  const _$DashboardReqUpdateTileDataUnionClockImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan});

  factory _$DashboardReqUpdateTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateTileDataUnionClockImplFromJson(json);

  /// Discriminator for the tile type
  @override
  final String type;

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

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.clock(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateTileDataUnionClockImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateTileDataUnionClockImplCopyWith<
          _$DashboardReqUpdateTileDataUnionClockImpl>
      get copyWith => __$$DashboardReqUpdateTileDataUnionClockImplCopyWithImpl<
          _$DashboardReqUpdateTileDataUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)
        devicePreview,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return clock(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return clock?.call(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(type, row, col, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqUpdateTileDataUnionClock value) clock,
    required TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqUpdateTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdateTileDataUnionClock
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardReqUpdateTileDataUnionClock(
          {required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'row_span') required final int rowSpan,
          @JsonKey(name: 'col_span') required final int colSpan}) =
      _$DashboardReqUpdateTileDataUnionClockImpl;

  factory DashboardReqUpdateTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdateTileDataUnionClockImpl.fromJson;

  /// Discriminator for the tile type
  @override
  String get type;

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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateTileDataUnionClockImplCopyWith<
          _$DashboardReqUpdateTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWith(
          _$DashboardReqUpdateTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardReqUpdateTileDataUnionWeatherDayImpl) then) =
      __$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdateTileDataUnionWeatherDayImpl>
    implements _$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardReqUpdateTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardReqUpdateTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqUpdateTileDataUnionWeatherDayImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateTileDataUnionWeatherDayImpl
    implements DashboardReqUpdateTileDataUnionWeatherDay {
  const _$DashboardReqUpdateTileDataUnionWeatherDayImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan});

  factory _$DashboardReqUpdateTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateTileDataUnionWeatherDayImplFromJson(json);

  /// Discriminator for the tile type
  @override
  final String type;

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

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.weatherDay(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateTileDataUnionWeatherDayImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqUpdateTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWithImpl<
                  _$DashboardReqUpdateTileDataUnionWeatherDayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)
        devicePreview,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherDay(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherDay?.call(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(type, row, col, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqUpdateTileDataUnionClock value) clock,
    required TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqUpdateTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdateTileDataUnionWeatherDay
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardReqUpdateTileDataUnionWeatherDay(
          {required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'row_span') required final int rowSpan,
          @JsonKey(name: 'col_span') required final int colSpan}) =
      _$DashboardReqUpdateTileDataUnionWeatherDayImpl;

  factory DashboardReqUpdateTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdateTileDataUnionWeatherDayImpl.fromJson;

  /// Discriminator for the tile type
  @override
  String get type;

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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqUpdateTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardReqUpdateTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardReqUpdateTileDataUnionWeatherForecastImpl value,
          $Res Function(_$DashboardReqUpdateTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdateTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdateTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardReqUpdateTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardReqUpdateTileDataUnionWeatherForecastImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqUpdateTileDataUnionWeatherForecastImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdateTileDataUnionWeatherForecastImpl
    implements DashboardReqUpdateTileDataUnionWeatherForecast {
  const _$DashboardReqUpdateTileDataUnionWeatherForecastImpl(
      {required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan});

  factory _$DashboardReqUpdateTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdateTileDataUnionWeatherForecastImplFromJson(json);

  /// Discriminator for the tile type
  @override
  final String type;

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

  @override
  String toString() {
    return 'DashboardReqUpdateTileDataUnion.weatherForecast(type: $type, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdateTileDataUnionWeatherForecastImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, row, col, rowSpan, colSpan);

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqUpdateTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardReqUpdateTileDataUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)
        devicePreview,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherForecast(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherForecast?.call(type, row, col, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String device,
            String? icon)?
        devicePreview,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String type,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(type, row, col, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqUpdateTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqUpdateTileDataUnionClock value) clock,
    required TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqUpdateTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdateTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqUpdateTileDataUnionClock value)? clock,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqUpdateTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdateTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdateTileDataUnionWeatherForecast
    implements DashboardReqUpdateTileDataUnion {
  const factory DashboardReqUpdateTileDataUnionWeatherForecast(
          {required final String type,
          required final int row,
          required final int col,
          @JsonKey(name: 'row_span') required final int rowSpan,
          @JsonKey(name: 'col_span') required final int colSpan}) =
      _$DashboardReqUpdateTileDataUnionWeatherForecastImpl;

  factory DashboardReqUpdateTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdateTileDataUnionWeatherForecastImpl.fromJson;

  /// Discriminator for the tile type
  @override
  String get type;

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

  /// Create a copy of DashboardReqUpdateTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdateTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqUpdateTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
