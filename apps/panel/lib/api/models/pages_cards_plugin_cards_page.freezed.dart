// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_cards_plugin_cards_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesCardsPluginCardsPage _$PagesCardsPluginCardsPageFromJson(
    Map<String, dynamic> json) {
  return _PagesCardsPluginCardsPage.fromJson(json);
}

/// @nodoc
mixin _$PagesCardsPluginCardsPage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// A list of cards associated with the page.
  List<PagesCardsPluginCard> get cards => throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this PagesCardsPluginCardsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesCardsPluginCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesCardsPluginCardsPageCopyWith<PagesCardsPluginCardsPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesCardsPluginCardsPageCopyWith<$Res> {
  factory $PagesCardsPluginCardsPageCopyWith(PagesCardsPluginCardsPage value,
          $Res Function(PagesCardsPluginCardsPage) then) =
      _$PagesCardsPluginCardsPageCopyWithImpl<$Res, PagesCardsPluginCardsPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<PagesCardsPluginCard> cards,
      int order});
}

/// @nodoc
class _$PagesCardsPluginCardsPageCopyWithImpl<$Res,
        $Val extends PagesCardsPluginCardsPage>
    implements $PagesCardsPluginCardsPageCopyWith<$Res> {
  _$PagesCardsPluginCardsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesCardsPluginCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? cards = null,
    Object? order = null,
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
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
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
      cards: null == cards
          ? _value.cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<PagesCardsPluginCard>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PagesCardsPluginCardsPageImplCopyWith<$Res>
    implements $PagesCardsPluginCardsPageCopyWith<$Res> {
  factory _$$PagesCardsPluginCardsPageImplCopyWith(
          _$PagesCardsPluginCardsPageImpl value,
          $Res Function(_$PagesCardsPluginCardsPageImpl) then) =
      __$$PagesCardsPluginCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<PagesCardsPluginCard> cards,
      int order});
}

/// @nodoc
class __$$PagesCardsPluginCardsPageImplCopyWithImpl<$Res>
    extends _$PagesCardsPluginCardsPageCopyWithImpl<$Res,
        _$PagesCardsPluginCardsPageImpl>
    implements _$$PagesCardsPluginCardsPageImplCopyWith<$Res> {
  __$$PagesCardsPluginCardsPageImplCopyWithImpl(
      _$PagesCardsPluginCardsPageImpl _value,
      $Res Function(_$PagesCardsPluginCardsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesCardsPluginCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? cards = null,
    Object? order = null,
  }) {
    return _then(_$PagesCardsPluginCardsPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
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
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<PagesCardsPluginCard>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PagesCardsPluginCardsPageImpl implements _PagesCardsPluginCardsPage {
  const _$PagesCardsPluginCardsPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.icon,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required final List<PagesCardsPluginCard> cards,
      this.order = 0})
      : _dataSource = dataSource,
        _cards = cards;

  factory _$PagesCardsPluginCardsPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$PagesCardsPluginCardsPageImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardModuleDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// A list of cards associated with the page.
  final List<PagesCardsPluginCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<PagesCardsPluginCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// The display order of the dashboard page in the navigation or list.
  @override
  @JsonKey()
  final int order;

  @override
  String toString() {
    return 'PagesCardsPluginCardsPage(id: $id, type: $type, title: $title, icon: $icon, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, cards: $cards, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesCardsPluginCardsPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            (identical(other.order, order) || other.order == order));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      title,
      icon,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_cards),
      order);

  /// Create a copy of PagesCardsPluginCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesCardsPluginCardsPageImplCopyWith<_$PagesCardsPluginCardsPageImpl>
      get copyWith => __$$PagesCardsPluginCardsPageImplCopyWithImpl<
          _$PagesCardsPluginCardsPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesCardsPluginCardsPageImplToJson(
      this,
    );
  }
}

abstract class _PagesCardsPluginCardsPage implements PagesCardsPluginCardsPage {
  const factory _PagesCardsPluginCardsPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String? icon,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final List<PagesCardsPluginCard> cards,
      final int order}) = _$PagesCardsPluginCardsPageImpl;

  factory _PagesCardsPluginCardsPage.fromJson(Map<String, dynamic> json) =
      _$PagesCardsPluginCardsPageImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// A list of cards associated with the page.
  @override
  List<PagesCardsPluginCard> get cards;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// Create a copy of PagesCardsPluginCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesCardsPluginCardsPageImplCopyWith<_$PagesCardsPluginCardsPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
