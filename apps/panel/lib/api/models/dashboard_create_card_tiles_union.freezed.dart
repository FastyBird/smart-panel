// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_card_tiles_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCardTilesUnion _$DashboardCreateCardTilesUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device-preview':
      return DashboardCreateCardTilesUnionDevicePreview.fromJson(json);
    case 'clock':
      return DashboardCreateCardTilesUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardCreateCardTilesUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardCreateCardTilesUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardCreateCardTilesUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardCreateCardTilesUnion {
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
    required TResult Function(DashboardCreateCardTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateCardTilesUnionClock value) clock,
    required TResult Function(DashboardCreateCardTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateCardTilesUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateCardTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult Function(DashboardCreateCardTilesUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCardTilesUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardTilesUnionCopyWith<DashboardCreateCardTilesUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory $DashboardCreateCardTilesUnionCopyWith(
          DashboardCreateCardTilesUnion value,
          $Res Function(DashboardCreateCardTilesUnion) then) =
      _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
          DashboardCreateCardTilesUnion>;
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
class _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateCardTilesUnion>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  _$DashboardCreateCardTilesUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCardTilesUnion
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
abstract class _$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWith(
          _$DashboardCreateCardTilesUnionDevicePreviewImpl value,
          $Res Function(_$DashboardCreateCardTilesUnionDevicePreviewImpl)
              then) =
      __$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateCardTilesUnionDevicePreviewImpl>
    implements _$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWith<$Res> {
  __$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWithImpl(
      _$DashboardCreateCardTilesUnionDevicePreviewImpl _value,
      $Res Function(_$DashboardCreateCardTilesUnionDevicePreviewImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
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
    return _then(_$DashboardCreateCardTilesUnionDevicePreviewImpl(
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
class _$DashboardCreateCardTilesUnionDevicePreviewImpl
    implements DashboardCreateCardTilesUnionDevicePreview {
  const _$DashboardCreateCardTilesUnionDevicePreviewImpl(
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

  factory _$DashboardCreateCardTilesUnionDevicePreviewImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardTilesUnionDevicePreviewImplFromJson(json);

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
    return 'DashboardCreateCardTilesUnion.devicePreview(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, device: $device, icon: $icon, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardTilesUnionDevicePreviewImpl &&
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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWith<
          _$DashboardCreateCardTilesUnionDevicePreviewImpl>
      get copyWith =>
          __$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWithImpl<
                  _$DashboardCreateCardTilesUnionDevicePreviewImpl>(
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
    required TResult Function(DashboardCreateCardTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateCardTilesUnionClock value) clock,
    required TResult Function(DashboardCreateCardTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateCardTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return devicePreview(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateCardTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return devicePreview?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult Function(DashboardCreateCardTilesUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardCreateCardTilesUnionWeatherForecast value)?
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
    return _$$DashboardCreateCardTilesUnionDevicePreviewImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardTilesUnionDevicePreview
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateCardTilesUnionDevicePreview(
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
      final int colSpan}) = _$DashboardCreateCardTilesUnionDevicePreviewImpl;

  factory DashboardCreateCardTilesUnionDevicePreview.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardTilesUnionDevicePreviewImpl.fromJson;

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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardTilesUnionDevicePreviewImplCopyWith<
          _$DashboardCreateCardTilesUnionDevicePreviewImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateCardTilesUnionClockImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardTilesUnionClockImplCopyWith(
          _$DashboardCreateCardTilesUnionClockImpl value,
          $Res Function(_$DashboardCreateCardTilesUnionClockImpl) then) =
      __$$DashboardCreateCardTilesUnionClockImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateCardTilesUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateCardTilesUnionClockImpl>
    implements _$$DashboardCreateCardTilesUnionClockImplCopyWith<$Res> {
  __$$DashboardCreateCardTilesUnionClockImplCopyWithImpl(
      _$DashboardCreateCardTilesUnionClockImpl _value,
      $Res Function(_$DashboardCreateCardTilesUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
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
    return _then(_$DashboardCreateCardTilesUnionClockImpl(
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
class _$DashboardCreateCardTilesUnionClockImpl
    implements DashboardCreateCardTilesUnionClock {
  const _$DashboardCreateCardTilesUnionClockImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateCardTilesUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardTilesUnionClockImplFromJson(json);

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
    return 'DashboardCreateCardTilesUnion.clock(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardTilesUnionClockImpl &&
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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardTilesUnionClockImplCopyWith<
          _$DashboardCreateCardTilesUnionClockImpl>
      get copyWith => __$$DashboardCreateCardTilesUnionClockImplCopyWithImpl<
          _$DashboardCreateCardTilesUnionClockImpl>(this, _$identity);

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
    required TResult Function(DashboardCreateCardTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateCardTilesUnionClock value) clock,
    required TResult Function(DashboardCreateCardTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateCardTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateCardTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult Function(DashboardCreateCardTilesUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardCreateCardTilesUnionWeatherForecast value)?
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
    return _$$DashboardCreateCardTilesUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardTilesUnionClock
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateCardTilesUnionClock(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardCreateCardTilesUnionClockImpl;

  factory DashboardCreateCardTilesUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardTilesUnionClockImpl.fromJson;

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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardTilesUnionClockImplCopyWith<
          _$DashboardCreateCardTilesUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateCardTilesUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardTilesUnionWeatherDayImplCopyWith(
          _$DashboardCreateCardTilesUnionWeatherDayImpl value,
          $Res Function(_$DashboardCreateCardTilesUnionWeatherDayImpl) then) =
      __$$DashboardCreateCardTilesUnionWeatherDayImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateCardTilesUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateCardTilesUnionWeatherDayImpl>
    implements _$$DashboardCreateCardTilesUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardCreateCardTilesUnionWeatherDayImplCopyWithImpl(
      _$DashboardCreateCardTilesUnionWeatherDayImpl _value,
      $Res Function(_$DashboardCreateCardTilesUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
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
    return _then(_$DashboardCreateCardTilesUnionWeatherDayImpl(
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
class _$DashboardCreateCardTilesUnionWeatherDayImpl
    implements DashboardCreateCardTilesUnionWeatherDay {
  const _$DashboardCreateCardTilesUnionWeatherDayImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateCardTilesUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardTilesUnionWeatherDayImplFromJson(json);

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
    return 'DashboardCreateCardTilesUnion.weatherDay(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardTilesUnionWeatherDayImpl &&
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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateCardTilesUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardCreateCardTilesUnionWeatherDayImplCopyWithImpl<
              _$DashboardCreateCardTilesUnionWeatherDayImpl>(this, _$identity);

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
    required TResult Function(DashboardCreateCardTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateCardTilesUnionClock value) clock,
    required TResult Function(DashboardCreateCardTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateCardTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateCardTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult Function(DashboardCreateCardTilesUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardCreateCardTilesUnionWeatherForecast value)?
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
    return _$$DashboardCreateCardTilesUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardTilesUnionWeatherDay
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateCardTilesUnionWeatherDay(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardCreateCardTilesUnionWeatherDayImpl;

  factory DashboardCreateCardTilesUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardTilesUnionWeatherDayImpl.fromJson;

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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateCardTilesUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWith(
          _$DashboardCreateCardTilesUnionWeatherForecastImpl value,
          $Res Function(_$DashboardCreateCardTilesUnionWeatherForecastImpl)
              then) =
      __$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateCardTilesUnionWeatherForecastImpl>
    implements
        _$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWithImpl(
      _$DashboardCreateCardTilesUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardCreateCardTilesUnionWeatherForecastImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
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
    return _then(_$DashboardCreateCardTilesUnionWeatherForecastImpl(
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
class _$DashboardCreateCardTilesUnionWeatherForecastImpl
    implements DashboardCreateCardTilesUnionWeatherForecast {
  const _$DashboardCreateCardTilesUnionWeatherForecastImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateCardTilesUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateCardTilesUnionWeatherForecastImplFromJson(json);

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
    return 'DashboardCreateCardTilesUnion.weatherForecast(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateCardTilesUnionWeatherForecastImpl &&
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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateCardTilesUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardCreateCardTilesUnionWeatherForecastImpl>(
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
    required TResult Function(DashboardCreateCardTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateCardTilesUnionClock value) clock,
    required TResult Function(DashboardCreateCardTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateCardTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateCardTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateCardTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateCardTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateCardTilesUnionClock value)? clock,
    TResult Function(DashboardCreateCardTilesUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardCreateCardTilesUnionWeatherForecast value)?
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
    return _$$DashboardCreateCardTilesUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateCardTilesUnionWeatherForecast
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateCardTilesUnionWeatherForecast(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardCreateCardTilesUnionWeatherForecastImpl;

  factory DashboardCreateCardTilesUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateCardTilesUnionWeatherForecastImpl.fromJson;

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

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateCardTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateCardTilesUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
