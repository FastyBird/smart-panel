// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_cards_plugin_create_cards_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesCardsPluginCreateCardsPage _$PagesCardsPluginCreateCardsPageFromJson(
    Map<String, dynamic> json) {
  return _PagesCardsPluginCreateCardsPage.fromJson(json);
}

/// @nodoc
mixin _$PagesCardsPluginCreateCardsPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// A list of cards associated with the page.
  List<PagesCardsPluginCreateCard> get cards =>
      throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this PagesCardsPluginCreateCardsPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesCardsPluginCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesCardsPluginCreateCardsPageCopyWith<PagesCardsPluginCreateCardsPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesCardsPluginCreateCardsPageCopyWith<$Res> {
  factory $PagesCardsPluginCreateCardsPageCopyWith(
          PagesCardsPluginCreateCardsPage value,
          $Res Function(PagesCardsPluginCreateCardsPage) then) =
      _$PagesCardsPluginCreateCardsPageCopyWithImpl<$Res,
          PagesCardsPluginCreateCardsPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      List<PagesCardsPluginCreateCard> cards,
      int order,
      String? icon});
}

/// @nodoc
class _$PagesCardsPluginCreateCardsPageCopyWithImpl<$Res,
        $Val extends PagesCardsPluginCreateCardsPage>
    implements $PagesCardsPluginCreateCardsPageCopyWith<$Res> {
  _$PagesCardsPluginCreateCardsPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesCardsPluginCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? cards = null,
    Object? order = null,
    Object? icon = freezed,
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      cards: null == cards
          ? _value.cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<PagesCardsPluginCreateCard>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PagesCardsPluginCreateCardsPageImplCopyWith<$Res>
    implements $PagesCardsPluginCreateCardsPageCopyWith<$Res> {
  factory _$$PagesCardsPluginCreateCardsPageImplCopyWith(
          _$PagesCardsPluginCreateCardsPageImpl value,
          $Res Function(_$PagesCardsPluginCreateCardsPageImpl) then) =
      __$$PagesCardsPluginCreateCardsPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      List<PagesCardsPluginCreateCard> cards,
      int order,
      String? icon});
}

/// @nodoc
class __$$PagesCardsPluginCreateCardsPageImplCopyWithImpl<$Res>
    extends _$PagesCardsPluginCreateCardsPageCopyWithImpl<$Res,
        _$PagesCardsPluginCreateCardsPageImpl>
    implements _$$PagesCardsPluginCreateCardsPageImplCopyWith<$Res> {
  __$$PagesCardsPluginCreateCardsPageImplCopyWithImpl(
      _$PagesCardsPluginCreateCardsPageImpl _value,
      $Res Function(_$PagesCardsPluginCreateCardsPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesCardsPluginCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? cards = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$PagesCardsPluginCreateCardsPageImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      cards: null == cards
          ? _value._cards
          : cards // ignore: cast_nullable_to_non_nullable
              as List<PagesCardsPluginCreateCard>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PagesCardsPluginCreateCardsPageImpl
    implements _PagesCardsPluginCreateCardsPage {
  const _$PagesCardsPluginCreateCardsPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      required final List<PagesCardsPluginCreateCard> cards,
      this.order = 0,
      this.icon})
      : _dataSource = dataSource,
        _cards = cards;

  factory _$PagesCardsPluginCreateCardsPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PagesCardsPluginCreateCardsPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardModuleCreateDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// A list of cards associated with the page.
  final List<PagesCardsPluginCreateCard> _cards;

  /// A list of cards associated with the page.
  @override
  List<PagesCardsPluginCreateCard> get cards {
    if (_cards is EqualUnmodifiableListView) return _cards;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_cards);
  }

  /// The position of the page in the dashboard’s list.
  @override
  @JsonKey()
  final int order;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'PagesCardsPluginCreateCardsPage(id: $id, type: $type, title: $title, dataSource: $dataSource, cards: $cards, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesCardsPluginCreateCardsPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            const DeepCollectionEquality().equals(other._cards, _cards) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      title,
      const DeepCollectionEquality().hash(_dataSource),
      const DeepCollectionEquality().hash(_cards),
      order,
      icon);

  /// Create a copy of PagesCardsPluginCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesCardsPluginCreateCardsPageImplCopyWith<
          _$PagesCardsPluginCreateCardsPageImpl>
      get copyWith => __$$PagesCardsPluginCreateCardsPageImplCopyWithImpl<
          _$PagesCardsPluginCreateCardsPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesCardsPluginCreateCardsPageImplToJson(
      this,
    );
  }
}

abstract class _PagesCardsPluginCreateCardsPage
    implements PagesCardsPluginCreateCardsPage {
  const factory _PagesCardsPluginCreateCardsPage(
      {required final String id,
      required final String type,
      required final String title,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      required final List<PagesCardsPluginCreateCard> cards,
      final int order,
      final String? icon}) = _$PagesCardsPluginCreateCardsPageImpl;

  factory _PagesCardsPluginCreateCardsPage.fromJson(Map<String, dynamic> json) =
      _$PagesCardsPluginCreateCardsPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource;

  /// A list of cards associated with the page.
  @override
  List<PagesCardsPluginCreateCard> get cards;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of PagesCardsPluginCreateCardsPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesCardsPluginCreateCardsPageImplCopyWith<
          _$PagesCardsPluginCreateCardsPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
