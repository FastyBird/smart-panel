// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_cards_plugin_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesCardsPluginCard _$PagesCardsPluginCardFromJson(Map<String, dynamic> json) {
  return _PagesCardsPluginCard.fromJson(json);
}

/// @nodoc
mixin _$PagesCardsPluginCard {
  /// A unique identifier for the dashboard card.
  String get id => throw _privateConstructorUsedError;

  /// The title displayed on the dashboard card.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard card.
  String? get icon => throw _privateConstructorUsedError;

  /// The unique identifier of the page this card belongs to.
  String get page => throw _privateConstructorUsedError;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  List<DashboardModuleTile> get tiles => throw _privateConstructorUsedError;

  /// A list of data sources used by the card, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard card was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard card was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Defines the position of the card relative to others on the dashboard page.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this PagesCardsPluginCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesCardsPluginCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesCardsPluginCardCopyWith<PagesCardsPluginCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesCardsPluginCardCopyWith<$Res> {
  factory $PagesCardsPluginCardCopyWith(PagesCardsPluginCard value,
          $Res Function(PagesCardsPluginCard) then) =
      _$PagesCardsPluginCardCopyWithImpl<$Res, PagesCardsPluginCard>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      String page,
      List<DashboardModuleTile> tiles,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      int order});
}

/// @nodoc
class _$PagesCardsPluginCardCopyWithImpl<$Res,
        $Val extends PagesCardsPluginCard>
    implements $PagesCardsPluginCardCopyWith<$Res> {
  _$PagesCardsPluginCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesCardsPluginCard
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
              as List<DashboardModuleTile>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleDataSource>,
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
abstract class _$$PagesCardsPluginCardImplCopyWith<$Res>
    implements $PagesCardsPluginCardCopyWith<$Res> {
  factory _$$PagesCardsPluginCardImplCopyWith(_$PagesCardsPluginCardImpl value,
          $Res Function(_$PagesCardsPluginCardImpl) then) =
      __$$PagesCardsPluginCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      String page,
      List<DashboardModuleTile> tiles,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      int order});
}

/// @nodoc
class __$$PagesCardsPluginCardImplCopyWithImpl<$Res>
    extends _$PagesCardsPluginCardCopyWithImpl<$Res, _$PagesCardsPluginCardImpl>
    implements _$$PagesCardsPluginCardImplCopyWith<$Res> {
  __$$PagesCardsPluginCardImplCopyWithImpl(_$PagesCardsPluginCardImpl _value,
      $Res Function(_$PagesCardsPluginCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesCardsPluginCard
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
    return _then(_$PagesCardsPluginCardImpl(
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
              as List<DashboardModuleTile>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleDataSource>,
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
class _$PagesCardsPluginCardImpl implements _PagesCardsPluginCard {
  const _$PagesCardsPluginCardImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.page,
      required final List<DashboardModuleTile> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      this.order = 0})
      : _tiles = tiles,
        _dataSource = dataSource;

  factory _$PagesCardsPluginCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$PagesCardsPluginCardImplFromJson(json);

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
  final List<DashboardModuleTile> _tiles;

  /// A list of tiles associated with the dashboard card, representing widgets or functional components.
  @override
  List<DashboardModuleTile> get tiles {
    if (_tiles is EqualUnmodifiableListView) return _tiles;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tiles);
  }

  /// A list of data sources used by the card, typically for real-time updates.
  final List<DashboardModuleDataSource> _dataSource;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource {
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
    return 'PagesCardsPluginCard(id: $id, title: $title, icon: $icon, page: $page, tiles: $tiles, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesCardsPluginCardImpl &&
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

  /// Create a copy of PagesCardsPluginCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesCardsPluginCardImplCopyWith<_$PagesCardsPluginCardImpl>
      get copyWith =>
          __$$PagesCardsPluginCardImplCopyWithImpl<_$PagesCardsPluginCardImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesCardsPluginCardImplToJson(
      this,
    );
  }
}

abstract class _PagesCardsPluginCard implements PagesCardsPluginCard {
  const factory _PagesCardsPluginCard(
      {required final String id,
      required final String title,
      required final String? icon,
      required final String page,
      required final List<DashboardModuleTile> tiles,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      final int order}) = _$PagesCardsPluginCardImpl;

  factory _PagesCardsPluginCard.fromJson(Map<String, dynamic> json) =
      _$PagesCardsPluginCardImpl.fromJson;

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
  List<DashboardModuleTile> get tiles;

  /// A list of data sources used by the card, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource;

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

  /// Create a copy of PagesCardsPluginCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesCardsPluginCardImplCopyWith<_$PagesCardsPluginCardImpl>
      get copyWith => throw _privateConstructorUsedError;
}
