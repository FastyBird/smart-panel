// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_card_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateCardTileDataUnion
    _$DashboardReqCreateCardTileDataUnionFromJson(Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device-preview':
      return DashboardReqCreateCardTileDataUnionDevicePreview.fromJson(json);
    case 'clock':
      return DashboardReqCreateCardTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardReqCreateCardTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardReqCreateCardTileDataUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqCreateCardTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqCreateCardTileDataUnion {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqCreateCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateCardTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateCardTileDataUnionCopyWith<
          DashboardReqCreateCardTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory $DashboardReqCreateCardTileDataUnionCopyWith(
          DashboardReqCreateCardTileDataUnion value,
          $Res Function(DashboardReqCreateCardTileDataUnion) then) =
      _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
          DashboardReqCreateCardTileDataUnion>;
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqCreateCardTileDataUnion>
    implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  _$DashboardReqCreateCardTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
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
abstract class _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWith<
    $Res> implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionDevicePreviewImpl)
              then) =
      __$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String device,
      String? icon,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl>
    implements
        _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionDevicePreviewImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? device = null,
    Object? icon = freezed,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqCreateCardTileDataUnionDevicePreviewImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
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
class _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl
    implements DashboardReqCreateCardTileDataUnionDevicePreview {
  const _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required this.device,
      this.icon,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the tile.
  @override
  final String? icon;

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
    return 'DashboardReqCreateCardTileDataUnion.devicePreview(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, device: $device, icon: $icon, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      device,
      icon,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return devicePreview(
        id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return devicePreview?.call(
        id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(
          id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqCreateCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return devicePreview(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return devicePreview?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionDevicePreview
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionDevicePreview(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int
          colSpan}) = _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl;

  factory DashboardReqCreateCardTileDataUnionDevicePreview.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the tile.
  String? get icon;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionDevicePreviewImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionDevicePreviewImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionClockImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionClockImpl) then) =
      __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionClockImpl>
    implements _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionClockImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqCreateCardTileDataUnionClockImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
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
class _$DashboardReqCreateCardTileDataUnionClockImpl
    implements DashboardReqCreateCardTileDataUnionClock {
  const _$DashboardReqCreateCardTileDataUnionClockImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionClockImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

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
    return 'DashboardReqCreateCardTileDataUnion.clock(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionClockImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionClockImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<
              _$DashboardReqCreateCardTileDataUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return clock(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return clock?.call(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqCreateCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionClock
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionClock(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardReqCreateCardTileDataUnionClockImpl;

  factory DashboardReqCreateCardTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionClockImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
    $Res> implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl)
              then) =
      __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
    implements
        _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
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
class _$DashboardReqCreateCardTileDataUnionWeatherDayImpl
    implements DashboardReqCreateCardTileDataUnionWeatherDay {
  const _$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionWeatherDayImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

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
    return 'DashboardReqCreateCardTileDataUnion.weatherDay(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionWeatherDayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherDay(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqCreateCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionWeatherDay
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionWeatherDay(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardReqCreateCardTileDataUnionWeatherDayImpl;

  factory DashboardReqCreateCardTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionWeatherDayImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl value,
          $Res Function(
                  _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
        $Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
            $Res> {
  __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
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
class _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl
    implements DashboardReqCreateCardTileDataUnionWeatherForecast {
  const _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

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
    return 'DashboardReqCreateCardTileDataUnion.weatherForecast(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherForecast(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherForecast?.call(
        id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardReqCreateCardTileDataUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionWeatherForecast
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionWeatherForecast(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int
          colSpan}) = _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl;

  factory DashboardReqCreateCardTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
