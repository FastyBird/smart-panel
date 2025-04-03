// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_cards_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCardsPage _$DashboardCardsPageFromJson(Map<String, dynamic> json) {
  return _DashboardCardsPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCardsPage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// A list of cards associated with the page.
  List<DashboardCard> get cards => throw _privateConstructorUsedError;

  /// A list of data sources associated with the page.
  @JsonKey(name: 'data_source')
  List<DashboardCardsPageDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this DashboardCardsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCardsPageCopyWith<DashboardCardsPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCardsPageCopyWith<$Res> {
  factory $DashboardCardsPageCopyWith(
          DashboardCardsPage value, $Res Function(DashboardCardsPage) then) =
      _$DashboardCardsPageCopyWithImpl<$Res, DashboardCardsPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCardsPageDataSourceUnion> dataSource,
      int order});
}

/// @nodoc
class _$DashboardCardsPageCopyWithImpl<$Res, $Val extends DashboardCardsPage>
    implements $DashboardCardsPageCopyWith<$Res> {
  _$DashboardCardsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? cards = null,
    Object? dataSource = null,
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
              as List<DashboardCard>,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardsPageDataSourceUnion>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCardsPageImplCopyWith<$Res>
    implements $DashboardCardsPageCopyWith<$Res> {
  factory _$$DashboardCardsPageImplCopyWith(_$DashboardCardsPageImpl value,
          $Res Function(_$DashboardCardsPageImpl) then) =
      __$$DashboardCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      List<DashboardCardsPageDataSourceUnion> dataSource,
      int order});
}

/// @nodoc
class __$$DashboardCardsPageImplCopyWithImpl<$Res>
    extends _$DashboardCardsPageCopyWithImpl<$Res, _$DashboardCardsPageImpl>
    implements _$$DashboardCardsPageImplCopyWith<$Res> {
  __$$DashboardCardsPageImplCopyWithImpl(_$DashboardCardsPageImpl _value,
      $Res Function(_$DashboardCardsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? cards = null,
    Object? dataSource = null,
    Object? order = null,
  }) {
    return _then(_$DashboardCardsPageImpl(
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
              as List<DashboardCard>,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCardsPageDataSourceUnion>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCardsPageImpl implements _DashboardCardsPage {
  const _$DashboardCardsPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.icon,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required final List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardsPageDataSourceUnion> dataSource,
      this.order = 0})
      : _cards = cards,
        _dataSource = dataSource;

  factory _$DashboardCardsPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCardsPageImplFromJson(json);

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

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// A list of cards associated with the page.
  final List<DashboardCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<DashboardCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// A list of data sources associated with the page.
  final List<DashboardCardsPageDataSourceUnion> _dataSource;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCardsPageDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The display order of the dashboard page in the navigation or list.
  @override
  @JsonKey()
  final int order;

  @override
  String toString() {
    return 'DashboardCardsPage(id: $id, type: $type, title: $title, icon: $icon, createdAt: $createdAt, updatedAt: $updatedAt, cards: $cards, dataSource: $dataSource, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCardsPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
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
      createdAt,
      updatedAt,
      const DeepCollectionEquality().hash(_cards),
      const DeepCollectionEquality().hash(_dataSource),
      order);

  /// Create a copy of DashboardCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCardsPageImplCopyWith<_$DashboardCardsPageImpl> get copyWith =>
      __$$DashboardCardsPageImplCopyWithImpl<_$DashboardCardsPageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCardsPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCardsPage implements DashboardCardsPage {
  const factory _DashboardCardsPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String? icon,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final List<DashboardCard> cards,
      @JsonKey(name: 'data_source')
      required final List<DashboardCardsPageDataSourceUnion> dataSource,
      final int order}) = _$DashboardCardsPageImpl;

  factory _DashboardCardsPage.fromJson(Map<String, dynamic> json) =
      _$DashboardCardsPageImpl.fromJson;

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
  List<DashboardCard> get cards;

  /// A list of data sources associated with the page.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCardsPageDataSourceUnion> get dataSource;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// Create a copy of DashboardCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCardsPageImplCopyWith<_$DashboardCardsPageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
