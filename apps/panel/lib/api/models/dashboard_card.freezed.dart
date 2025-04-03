// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCard _$DashboardCardFromJson(Map<String, dynamic> json) {
  return _DashboardCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardCard {
  /// A unique identifier for the dashboard card.
  String get id => throw _privateConstructorUsedError;

  /// The title displayed on the dashboard card.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard card.
  String? get icon => throw _privateConstructorUsedError;

  /// The unique identifier of the page this card belongs to.
  String get page => throw _privateConstructorUsedError;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  List<DashboardCardTilesUnion> get tiles => throw _privateConstructorUsedError;

  /// A list of data sources used by the card, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCardDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard card was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard card was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Defines the position of the card relative to others on the dashboard page.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this DashboardCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCardCopyWith<DashboardCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCardCopyWith<$Res> {
  factory $DashboardCardCopyWith(
          DashboardCard value, $Res Function(DashboardCard) then) =
      _$DashboardCardCopyWithImpl<$Res, DashboardCard>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      String page,
      List<DashboardCardTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCardDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      int order});
}

/// @nodoc
class _$DashboardCardCopyWithImpl<$Res, $Val extends DashboardCard>
    implements $DashboardCardCopyWith<$Res> {
  _$DashboardCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? page = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? order = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      tiles: null == tiles
          ? _value.tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardTilesUnion>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCardImplCopyWith<$Res>
    implements $DashboardCardCopyWith<$Res> {
  factory _$$DashboardCardImplCopyWith(
          _$DashboardCardImpl value, $Res Function(_$DashboardCardImpl) then) =
      __$$DashboardCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      String page,
      List<DashboardCardTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      List<DashboardCardDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      int order});
}

/// @nodoc
class __$$DashboardCardImplCopyWithImpl<$Res>
    extends _$DashboardCardCopyWithImpl<$Res, _$DashboardCardImpl>
    implements _$$DashboardCardImplCopyWith<$Res> {
  __$$DashboardCardImplCopyWithImpl(
      _$DashboardCardImpl _value, $Res Function(_$DashboardCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? page = null,
    Object? tiles = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? order = null,
  }) {
    return _then(_$DashboardCardImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      tiles: null == tiles
          ? _value._tiles
          : tiles // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardTilesUnion>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCardImpl implements _DashboardCard {
  const _$DashboardCardImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.page,
      required final List<DashboardCardTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      this.order = 0})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$DashboardCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCardImplFromJson(json);

  /// A unique identifier for the dashboard card.
  @override
  final String id;

  /// The title displayed on the dashboard card.
  @override
  final String title;

  /// The icon representing the dashboard card.
  @override
  final String? icon;

  /// The unique identifier of the page this card belongs to.
  @override
  final String page;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  final List<DashboardCardTilesUnion> _tiles;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  @override
  List<DashboardCardTilesUnion> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources used by the card, typically for real-time updates.
  final List<DashboardCardDataSourceUnion> _dataSource;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCardDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard card was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard card was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  @JsonKey()
  final int order;

  @override
  String toString() {
    return 'DashboardCard(id: $id, title: $title, icon: $icon, page: $page, tiles: $tiles, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCardImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.page, page) || other.page == page) &&
            const DeepCollectionEquality().equals(other._tiles, _tiles) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.order, order) || other.order == order));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      title,
      icon,
      page,
      const DeepCollectionEquality().hash(_tiles),
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      order);

  /// Create a copy of DashboardCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCardImplCopyWith<_$DashboardCardImpl> get copyWith =>
      __$$DashboardCardImplCopyWithImpl<_$DashboardCardImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardCard implements DashboardCard {
  const factory _DashboardCard(
      {required final String id,
      required final String title,
      required final String? icon,
      required final String page,
      required final List<DashboardCardTilesUnion> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      final int order}) = _$DashboardCardImpl;

  factory _DashboardCard.fromJson(Map<String, dynamic> json) =
      _$DashboardCardImpl.fromJson;

  /// A unique identifier for the dashboard card.
  @override
  String get id;

  /// The title displayed on the dashboard card.
  @override
  String get title;

  /// The icon representing the dashboard card.
  @override
  String? get icon;

  /// The unique identifier of the page this card belongs to.
  @override
  String get page;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  @override
  List<DashboardCardTilesUnion> get tiles;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCardDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard card was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard card was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  int get order;

  /// Create a copy of DashboardCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCardImplCopyWith<_$DashboardCardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
