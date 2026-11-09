---
title: "Melos 모노레포로 나눈 Flutter 즐겨찾기 앱, search_favorites 의 구조"
description: "GitHub 저장소를 검색해 즐겨찾기로 저장하는 Flutter 앱 search_favorites 를 Melos 모노레포의 패키지 구성, Riverpod·go_router·drift 선택, 검색에서 즐겨찾기 저장까지의 데이터 흐름 순서로 정리했습니다."
pubDatetime: 2025-08-21T23:05:00+09:00
category: flutter
tags:
  - Flutter
  - Melos
  - 아키텍처
  - Riverpod
---

Flutter 로 혼자 진행한 개인 프로젝트입니다. [search_favorites](https://github.com/TeddKo/search_favorites) 는 GitHub 저장소를 검색해서 마음에 드는 것을 즐겨찾기로 저장해 두는 앱입니다. 기능만 보면 화면 두 개짜리 작은 앱인데 구조는 크게 잡았습니다. README 에 적어 둔 대로 클린 아키텍처와 멀티 패키지 구성이 바탕입니다. 코드 기준으로 어떤 모양인지 적어 둡니다.

## 앱이 하는 일

README 에 적힌 기능은 세 가지입니다. GitHub API 로 저장소를 실시간 검색하고, 검색한 저장소를 로컬 데이터베이스에 즐겨찾기로 저장하며, 가장 최근에 추가한 즐겨찾기를 홈 화면 위젯에 보여 줍니다. 앱 안에는 하단 탭이 두 개(Search, Favorites) 있고 검색 결과의 하트를 누르면 즐겨찾기가 토글됩니다.

README 에는 스크린샷이 없어서 이 글의 그림은 저장소의 `pubspec.yaml` 과 소스를 읽고 직접 그렸습니다. 두 그림 모두 코드에 있는 것만 담았습니다.

README 의 라이브러리 표를 옮기면 이렇습니다.

| 역할         | 라이브러리                                     |
| ------------ | ---------------------------------------------- |
| 상태 관리·DI | `flutter_riverpod`, `riverpod_generator`       |
| 라우팅       | `go_router`                                    |
| 네트워크     | `dio`                                          |
| 로컬 저장소  | `drift`                                        |
| 코드 생성    | `freezed`, `json_serializable`, `build_runner` |
| 그 외        | `flutter_dotenv`, `logger`, `home_widget`      |

플랫폼 폴더는 android, ios, linux, macos, web, windows 가 모두 있습니다. 홈 위젯만은 `android/` 아래 Kotlin 코드(`LatestFavoriteWidget.kt`, `LatestFavoriteWidgetReceiver.kt`)로 구현되어 있어서 Android 에서만 동작합니다.

## Melos 로 나눈 패키지

루트의 `melos.yaml` 은 단출합니다. `packages/**` 를 전부 워크스페이스로 잡고 스크립트 몇 개를 정의합니다.

```yaml
# melos.yaml
packages:
  - packages/**

scripts:
  build:
    run: melos exec --order-dependents -- "flutter pub run build_runner build --delete-conflicting-outputs"
```

`get`, `analyze`, `test`, `clean` 도 `melos exec` 를 감싼 한 줄입니다. 신경 쓸 스크립트는 `build` 입니다. freezed 와 riverpod_generator 가 만드는 `*.g.dart`, `*.freezed.dart` 는 `.gitignore` 에 들어 있어서 저장소에 없습니다. 클론한 뒤에는 `melos bootstrap` 으로 의존성을 받고 `melos run build` 로 생성 코드를 만들어야 합니다. `--order-dependents` 가 붙은 것은 아래쪽 패키지의 생성물이 먼저 있어야 위쪽 패키지가 빌드되기 때문입니다.

패키지는 루트 앱을 빼고 열두 개입니다. 이름은 폴더 구조와 pubspec 의 `name` 이 일치합니다.

![app 에서 router, feature, core_data, core_domain, 데이터 소스, 공통 패키지로 이어지는 search_favorites 의 패키지 의존 방향 다이어그램](@/assets/images/posts/search-favorites/sf-packages.png)

그림은 각 패키지 `pubspec.yaml` 의 `path:` 의존을 그대로 옮겼습니다. 맨 아래 `shared_common`, `shared_util` 은 앱 내부 패키지를 의존하지 않고 외부 패키지(`freezed_annotation`, `logger`)만 씁니다. `core_domain` 이 가리키는 것은 `shared_common` 하나뿐이고, `core_data` 가 `core_domain`, `core_network`, `core_database` 를 모두 알고 있습니다. Android 의 `core:data` 가 `core:domain` 과 소스 모듈을 묶는 자리와 같습니다. 도메인은 데이터 소스를 모릅니다.

feature 패키지는 셋입니다. `feature_search` 와 `feature_favorites` 는 도메인, 데이터, 공용 UI 를 쓰고 `feature_root` 는 하단 탭 껍데기만 맡아서 `core_data` 를 쓰지 않습니다. 루트 앱의 `pubspec.yaml` 이 직접 의존하는 것은 `router`, `core_designsystem`, `core_data`, `shared_common` 넷입니다. 화면 패키지는 앱에 직접 붙지 않고 `router` 를 거쳐 조립됩니다.

## 도메인이 가진 것

`core_domain` 에는 `Repository` 모델과 저장소 인터페이스 둘(`SearchRepository`, `FavoritesRepository`), UseCase 여섯 개가 있습니다. 모델은 freezed 로 만든 불변 클래스입니다.

```dart
// packages/core/domain/lib/src/model/repository.dart
@freezed
sealed class Repository with _$Repository {
  const factory Repository({
    required int id,
    required String name,
    required String? description,
    required int stargazersCount,
    required int forksCount,
    @Default(false) bool isFavorite,
  }) = _Repository;
}
```

UseCase 는 추상 클래스와 `Impl` 이 한 파일에 들어 있고 대부분 저장소 메서드를 한 번 부르는 얇은 껍데기입니다. 반환 타입은 `shared_common` 의 `Result<T>` 입니다.

```dart
// packages/shared/common/lib/src/result/result.dart
@freezed
sealed class Result<T> with _$Result<T> {
  const factory Result.success(T data) = Success;
  const factory Result.error(Exception e) = Error;
}
```

예외를 던지지 않고 `Result` 에 담아 올려 보내므로 ViewModel 은 `result.when(success: ..., error: ...)` 한 곳에서 두 경우를 처리합니다.

## 상태 관리는 Riverpod 위의 MVI

README 는 MVI 를 적용했다고 적었고 코드도 그 모양입니다. 화면마다 `Intent`, `State`, `ViewModel` 이 있으며 Intent 와 State 는 freezed 로 만듭니다.

```dart
// packages/feature/search/lib/src/intent/search_intent.dart
@freezed
sealed class SearchIntent with _$SearchIntent {
  const factory SearchIntent.search(String query) = _Search;
  const factory SearchIntent.fetchNextPage() = _FetchNextPage;
  const factory SearchIntent.toggleFavorite(Repository repository) = _ToggleFavorite;
}
```

ViewModel 은 `riverpod_annotation` 의 `@riverpod` 클래스(Notifier)입니다. 화면이 부르는 것은 `onIntent` 하나이고 ViewModel 이 Intent 를 `when` 으로 갈라 처리합니다.

```dart
// packages/feature/search/lib/src/search_view_model.dart
void onIntent(SearchIntent intent) {
  intent.when(
    search: _search,
    fetchNextPage: _fetchNextPage,
    toggleFavorite: _toggleFavorite,
  );
}
```

Android 의 `UiState` 와 이벤트 구조와 닮았습니다. 화면은 `ref.watch(searchViewModelProvider)` 로 상태를 읽어 그리기만 합니다. 검색어 입력에는 300ms 디바운스가 걸려 있는데 이 타이머는 ViewModel 이 아니라 `SearchScreen` 의 `State` 에 있습니다. 스크롤이 전체 길이의 90% 에 닿으면 `fetchNextPage` Intent 를 보내 다음 페이지를 불러옵니다.

## DI 도 Riverpod 으로

별도 DI 컨테이너 없이 provider 가 그 역할을 합니다. 의존 사슬은 `@riverpod` 함수 한 줄씩으로 이어집니다.

```dart
// packages/core/data/lib/src/repository/search_repository.dart
@riverpod
SearchRepository searchRepository(Ref ref) {
  return SearchRepositoryImpl(ref.watch(searchDataSourceProvider));
}
```

```dart
// packages/core/data/lib/src/datasource/search_datasource.dart
@riverpod
SearchDataSource searchDataSource(Ref ref) {
  return SearchDataSourceImpl(ref.watch(dioProvider));
}
```

`dioProvider` 는 `core_network` 의 `dio.dart` 에 있습니다. baseUrl 은 `https://api.github.com` 이고 토큰은 `.env` 의 `GITHUB_API_TOKEN` 을 `flutter_dotenv` 로 읽어 `Authorization` 헤더에 넣습니다. `.env` 는 `.gitignore` 에 들어 있고 pubspec 에는 assets 로만 등록되어 있습니다. `.env` 는 Flutter 에셋으로 앱 번들에 포함되므로 저장소에서 제외해도 빌드된 앱 안의 토큰은 추출될 수 있습니다. DB 는 `core_database` 의 `favoriteDatabaseProvider` 가 `keepAlive: true` 로 하나만 만듭니다.

`main.dart` 에서는 `ProviderContainer` 를 직접 만들어 `UncontrolledProviderScope` 로 앱에 넘깁니다. 이유는 아래 위젯 쪽에 나옵니다.

## 검색에서 즐겨찾기 저장까지

검색 한 번과 하트 한 번이 코드에서 지나가는 길을 순서대로 그리면 다음 그림입니다.

![검색어 입력부터 GitHub API 호출, 결과 표시, 하트 탭으로 drift 에 저장되고 스트림이 다시 검색 목록을 갱신하는 시퀀스 다이어그램](@/assets/images/posts/search-favorites/sf-flow.png)

검색 쪽은 직선입니다. `core_network` 의 `SearchDataSourceImpl` 이 `dio` 로 `/search/repositories` 를 `per_page: 30` 으로 부르고, `SearchRepositoryImpl` 이 응답의 `items` 를 mapper 의 `toData()` 로 도메인 `Repository` 에 옮겨 `Result.success` 에 담습니다.

재미있는 곳은 하트를 눌렀을 때입니다. `_toggleFavorite` 는 현재 `favoriteIds` 에 들어 있으면 삭제 UseCase 를, 없으면 추가 UseCase 를 부르고 거기서 끝납니다. 목록의 `isFavorite` 는 직접 바꾸지 않습니다.

```dart
// packages/feature/search/lib/src/search_view_model.dart
if (state.favoriteIds.contains(repository.id)) {
  await removeFavoriteUseCase(repository.id);
} else {
  await addFavoriteUseCase(repository);
}
```

하트가 채워지는 것은 다른 경로를 타고 옵니다. drift 의 `watchFavoriteRepoIds()` 가 즐겨찾기 id 목록을 `Stream` 으로 내보내고, 그 스트림이 `favoritesIdsStreamProvider` 가 되어 `SearchViewModel.build()` 안의 `ref.listen` 에 닿습니다. 리스너는 id 집합을 다시 계산해 현재 목록의 `isFavorite` 를 덮어씁니다.

```dart
// packages/feature/search/lib/src/search_view_model.dart
ref.listen(favoritesIdsStreamProvider, (previous, next) {
  if (next.hasValue) {
    final favoritesIds = (next.value ?? []).toSet();
    final updatedRepositories = state.repositories.map((repo) {
      return repo.copyWith(isFavorite: favoritesIds.contains(repo.id));
    }).toList();
    state = state.copyWith(repositories: updatedRepositories, favoriteIds: favoritesIds);
  }
}, fireImmediately: true);
```

Google 가이드가 말하는 SSOT 를 그대로 따른 모양입니다. 즐겨찾기 여부는 로컬 DB 한 곳에만 있고 화면 상태는 그것을 구독해서 만들어집니다. 같은 스트림을 `FavoritesViewModel` 도 듣고 있어서(`previous != null` 일 때 `_refresh`) 검색 화면에서 토글하면 즐겨찾기 탭의 목록도 갱신됩니다. 낙관적 업데이트 코드는 따로 필요하지 않았습니다.

저장 쪽 테이블은 `core_database` 의 `FavoriteRepositories` 입니다. `repoId` 에 unique 제약이 있고 `createdAt` 컬럼이 있습니다. 삽입은 `onConflict: DoUpdate` 를 쓰지만 `target` 을 지정하지 않았습니다. drift 는 이때 기본 키(autoIncrement `id`)를 충돌 대상으로 삼기 때문에, 같은 `repoId` 를 다시 넣으면 갱신이 아니라 UNIQUE 제약 오류가 납니다. 앱은 이미 즐겨찾기인 항목에 추가 UseCase 를 부르지 않아 이 경로가 드러나지 않습니다. `repoId` 기준 upsert 로 쓰려면 `DoUpdate(..., target: [favoriteRepositories.repoId])` 처럼 대상을 지정해야 합니다. 스키마 버전은 2이며 1에서 올라올 때 `createdAt` 을 추가하는 마이그레이션이 들어 있습니다. 이 컬럼은 가장 최근 즐겨찾기를 고를 때 정렬 기준이 됩니다.

## 홈 위젯은 Flutter 밖에서 읽습니다

위젯은 Android 의 Jetpack Glance 로 그립니다. `LatestFavoriteWidget` 이 `HomeWidgetGlanceStateDefinition` 위에서 SharedPreferences 의 `name`, `description`, `stargazersCount`, `forksCount` 를 읽고, 탭하면 `searchfavorites://app/favorites` 로 앱을 엽니다.

값을 채우는 쪽은 Dart 입니다. `FavoritesViewModel._updateWidget` 이 최신 즐겨찾기 한 건을 읽어 `HomeWidget.saveWidgetData` 로 저장한 다음 `HomeWidget.updateWidget` 을 부릅니다. 즐겨찾기를 불러오거나 삭제한 직후마다 실행됩니다. `main.dart` 에는 `com.tedd.search_favorites.widget` 이라는 `MethodChannel` 도 있습니다. `getLatestFavorite` 호출이 오면 컨테이너에서 UseCase provider 를 꺼내 읽고 이름과 설명을 돌려줍니다. 앞에서 `ProviderContainer` 를 직접 만들어 둔 덕분에 위젯 트리 바깥의 채널 핸들러에서도 `ref` 없이 provider 를 읽을 수 있습니다.

위젯 클릭은 `HomeWidget.widgetClicked` 스트림과 `initiallyLaunchedFromHomeWidget` 로 받아 `go_router` 의 `router.go('/favorites')` 로 연결합니다.

## 라우팅

`router` 패키지의 provider 하나가 `GoRouter` 를 만듭니다. `StatefulShellRoute.indexedStack` 의 두 브랜치가 `/search` 와 `/favorites` 이고 껍데기는 `feature_root` 의 `RootScreen` 이 하단 `BottomNavigationBar` 로 그립니다. 시작 위치는 `/search` 이고 전환 애니메이션은 `NoTransitionPage` 로 껐습니다.

```dart
// packages/router/lib/src/router.dart
GoRoute(
  path: '/search',
  pageBuilder: (context, state) =>
      const NoTransitionPage(child: SearchScreen()),
),
```

## 패키지 의존 선언

`feature_search`, `feature_favorites`, `feature_root` 의 `pubspec.yaml` 에는 `router` 가 의존으로 적혀 있고 `router` 도 세 feature 에 의존합니다. 실제 Dart 코드에서 `package:router` 를 import 하는 곳은 `lib/main.dart` 하나입니다. 그림에 feature 에서 router 로 가는 화살표가 없는 까닭입니다.

feature 패키지는 `core_data` 를 직접 import 해서 `searchRepositoryProvider` 같은 provider 를 씁니다. `feature_search` 와 `feature_favorites` 의 `src/di/` 에는 UseCase provider 가 하나씩 있습니다.

테스트는 `test/widget_test.dart` 하나이고 Flutter 템플릿의 카운터 스모크 테스트입니다. `melos.yaml` 에는 `test` 스크립트가 있습니다.

패키지마다 의존이 pubspec 에 선언되어 있어 어떤 패키지가 무엇을 아는지 파일 하나로 확인됩니다. 데이터 소스를 바꿔도 변경은 `core_data` 안에서 끝납니다.

저장소는 [TeddKo/search_favorites](https://github.com/TeddKo/search_favorites) 에 있습니다. `.env` 에 `GITHUB_API_TOKEN` 을 넣고 `melos bootstrap`, `melos run build`, `flutter run` 순서로 실행하면 됩니다.

## 참고 자료

- [Melos](https://melos.invertase.dev/)
- [Melos exec](https://melos.invertase.dev/commands/exec)
- [Riverpod](https://riverpod.dev/docs/introduction/getting_started)
- [riverpod_generator](https://pub.dev/packages/riverpod_generator)
- [go_router StatefulShellRoute](https://pub.dev/documentation/go_router/latest/go_router/StatefulShellRoute-class.html)
- [drift DoUpdate](https://pub.dev/documentation/drift/latest/drift/DoUpdate-class.html)
- [drift migrations](https://drift.simonbinder.eu/migrations/)
- [home_widget](https://pub.dev/packages/home_widget)
- [freezed](https://pub.dev/packages/freezed)
- [flutter_dotenv](https://pub.dev/packages/flutter_dotenv)
- [GitHub REST: Search repositories](https://docs.github.com/en/rest/search/search#search-repositories)
