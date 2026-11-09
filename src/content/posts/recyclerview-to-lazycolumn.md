---
title: "RecyclerView 에서 LazyColumn 까지: 어댑터가 DSL 이 되기까지"
description: "ListView 의 ViewHolder 관례에서 RecyclerView 의 Adapter·LayoutManager·ItemAnimator·DiffUtil 로, 다시 Compose 의 LazyColumn·그리드·animateItem 으로 이어지는 흐름을 개념 대응표, 같은 목록의 before/after 코드, 상호운용 방법과 공식 문서의 성능 권고로 정리합니다."
pubDatetime: 2026-09-15T21:30:00+09:00
category: android
tags:
  - Android
  - RecyclerView
  - Compose
  - LazyColumn
---

화면보다 긴 목록은 모든 항목의 View 나 composition 을 한 번에 만들 수 없으므로 화면에 보이는 항목만 만들고 나머지는 다시 쓰거나 버립니다. Android 에서 이 역할은 `ListView`, `RecyclerView`, Compose 의 Lazy 레이아웃 순서로 옮겨 왔습니다. 이 글은 각 단계의 구성 요소를 공식 문서 기준으로 짚고 RecyclerView 의 개념이 Lazy 레이아웃의 무엇에 대응하는지, 같은 목록을 두 방식으로 작성하면 어떻게 달라지는지, 두 세계를 섞어 쓸 때 무엇을 신경 써야 하는지를 정리합니다.

## ListView 와 ViewHolder 관례

`ListView` 는 `Adapter.getView(position, convertView, parent)` 로 항목 View 를 받습니다. 공식 레퍼런스는 `convertView` 를 "The old view to reuse, if possible" 로 설명합니다. 화면 밖으로 나간 View 를 다시 넘겨 줄 테니 가능하면 재사용하라는 뜻이고, 재사용할지는 어댑터 구현에 맡겨져 있습니다.

재사용해도 문제가 하나 남습니다. 예전 Android 문서(Making ListView Scrolling Smooth)는 어댑터가 재사용할 View 를 돌려주더라도 그 안의 자식 View 를 `findViewById()` 로 찾고 값을 채우는 일은 매번 해야 하고, 이 조회를 피하는 방법이 "view holder" 디자인 패턴이라고 설명합니다. 자식 View 참조를 `ViewHolder` 객체에 담아 레이아웃의 tag 에 붙여 두는 방식입니다. 이 시기의 ViewHolder 는 프레임워크가 강제하는 타입이 아니라 개발자가 지키는 관례였습니다.

## RecyclerView 의 구성 요소

RecyclerView 는 Support Library revision 21 (2014년 10월) 에서 `v7 recyclerview` 라이브러리로 처음 추가됐습니다. 같은 revision 의 변경 목록에는 Android 5.0 (API level 21) 용 Fragment transition 지원과 `CardView` 추가가 들어 있습니다. 릴리스 노트는 RecyclerView 를 "a flexible list view for providing a limited window into a large data set" 으로 소개합니다. 지금은 `androidx.recyclerview:recyclerview` 아티팩트로 배포됩니다.

공식 가이드에 따르면 항목이 화면 밖으로 스크롤되어도 RecyclerView 는 그 View 를 파괴하지 않고 새로 화면에 들어오는 항목에 다시 씁니다. 이 구조는 역할이 나뉜 몇 개의 부품으로 이루어집니다.

- **`ViewHolder`**: 항목 하나의 View 를 감싼 객체입니다. 만들어진 직후에는 데이터가 없고 이후 RecyclerView 가 데이터에 바인딩합니다. ListView 의 관례가 클래스로 굳어진 셈입니다.
- **`Adapter`**: `onCreateViewHolder()` 는 ViewHolder 와 View 를 만들되 내용은 채우지 않고, `onBindViewHolder()` 는 ViewHolder 에 데이터를 채우며, `getItemCount()` 는 데이터 크기를 돌려줍니다.
- **`LayoutManager`**: 항목을 배치합니다. 라이브러리가 `LinearLayoutManager`, `GridLayoutManager`, `StaggeredGridLayoutManager` 세 가지를 제공하고 `LayoutManager` 추상 클래스를 상속해 직접 만들 수도 있습니다.
- **`ItemDecoration`**: 어댑터 데이터의 특정 항목에 별도의 그리기와 레이아웃 오프셋을 더합니다. 레퍼런스는 항목 사이 구분선, 강조 표시, 시각적 그룹 경계를 용도로 듭니다.
- **`ItemAnimator`**: 어댑터 변경 때 항목에 적용되는 애니메이션을 정의합니다. 기본 구현은 추가, 삭제, 이동에 대한 기본 애니메이션을 제공합니다.
- **`RecycledViewPool`**: 화면 밖으로 나간 ViewHolder 를 `viewType` 별로 보관합니다. 레퍼런스는 여러 RecyclerView 가 풀을 공유하려면 `RecycledViewPool` 인스턴스를 만들어 `setRecycledViewPool` 로 넘기면 된다고 설명하고, 지정하지 않으면 RecyclerView 가 자체 풀을 만듭니다.

이후 라이브러리에 추가된 보조 장치도 있습니다.

- **`DiffUtil`**: Support Library 24.2.0 (2016년 8월) 에서 추가됐습니다. 두 목록의 차이를 계산해 어댑터가 소비할 수 있는 갱신 연산 목록으로 돌려줍니다. 레퍼런스에 따르면 Eugene W. Myers 의 차이 알고리즘으로 최소 갱신 수를 계산하고, Myers 알고리즘이 이동을 처리하지 못하므로 두 번째 패스에서 이동을 감지합니다. 사용 중에 목록이나 항목이 바뀌면 안 되므로 변경 시에는 새 목록을 만들어 넘겨야 합니다.
- **`ListAdapter`**: Support Library 27.1.0 (2018년 2월) 에서 `AsyncListDiffer` 와 함께 추가됐습니다. 백그라운드 스레드에서 목록 차이를 계산하고 `submitList` 로 새 목록을 받는 어댑터 기반 클래스입니다.
- **stable ID**: `setHasStableIds(true)` 로 항목이 `Long` 타입의 고유 식별자를 가진다고 알리고 `getItemId()` 를 구현합니다.
- **`ConcatAdapter`**: RecyclerView 1.2.0 (2021년 4월 7일) 에서 정식 출시됐습니다. 여러 어댑터의 내용을 순서대로 이어 붙여 하나의 RecyclerView 에 보여 줍니다. 1.2.0-alpha02 (2020년 4월 1일) 의 `MergeAdapter` 로 시작해 1.2.0-alpha04 에서 이름이 바뀌었습니다. 기본 설정에서는 중첩된 어댑터끼리 view type 을 격리해서 어댑터마다 별도의 ViewHolder 풀을 가집니다.

## Compose 의 Lazy 레이아웃

Compose 는 목록을 `LazyColumn`, `LazyRow` 와 그리드 계열 컴포저블로 제공합니다. 공식 가이드는 이들이 화면에 보이는 항목만 compose 하고 배치한다고 설명합니다. 항목은 `LazyListScope` 의 DSL 로 선언합니다.

```kotlin
LazyColumn {
    item { Header() }
    items(messages, key = { it.id }, contentType = { it.type }) { message ->
        MessageRow(message)
    }
}
```

`item`, `items`, `itemsIndexed`, `stickyHeader` 를 한 블록 안에서 섞어 쓸 수 있습니다. 가이드는 같은 방향의 스크롤 컨테이너를 중첩하는 대신 부모 `LazyColumn` 하나에 여러 종류의 내용을 DSL 로 이어 붙이라고 안내하는데, 이는 `ConcatAdapter` 로 어댑터를 이어 붙이던 용도와 맞닿아 있습니다. 다만 문서가 두 기능을 같다고 하지는 않습니다.

### key 와 contentType

기본값에서 각 항목의 상태는 목록 안의 위치를 키로 삼습니다. 가이드는 데이터셋이 바뀌어 항목의 위치가 달라지면 `remember` 로 기억한 상태를 잃는 문제가 생긴다고 설명하고, `key` 파라미터로 안정적이고 고유한 키를 주라고 안내합니다. 키의 타입은 Activity 재생성 때 상태를 유지하는 `Bundle` 이 지원하는 타입이어야 합니다.

`contentType` 은 Compose 1.2 (foundation 1.2.0, 2022년 7월 27일) 부터 쓸 수 있고, 가이드는 `contentType` 을 주면 "Compose is able to reuse compositions only between the items of the same type" 이라고 설명합니다. `LazyListScope.items` 레퍼런스도 같은 타입의 composition 이 더 효율적으로 재사용될 수 있다고 적습니다.

![RecyclerView 는 화면 밖으로 나간 ViewHolder 를 viewType 별 RecycledViewPool 에 보관했다가 onBindViewHolder 로 다른 데이터를 바인딩하고, LazyColumn 은 contentType 이 같은 항목끼리 composition 을 재사용한다는 비교 다이어그램](@/assets/images/recyclerview-to-lazycolumn-reuse.png)

RecyclerView 는 View 객체를 풀에 보관했다가 다시 바인딩하고, Lazy 레이아웃은 View 대신 composition 을 재사용합니다. RecyclerView 이관 가이드는 `contentType` 을 "a similar concept to RecyclerView's view types" 로 설명합니다.

### LazyListState 와 스크롤 위치

`rememberLazyListState()` 로 만든 `LazyListState` 를 `state` 파라미터에 넘기면 스크롤 위치를 읽고 제어할 수 있습니다. 가이드가 소개하는 속성은 `firstVisibleItemIndex`, `firstVisibleItemScrollOffset`, `layoutInfo` 이고 `scrollToItem()` 은 즉시, `animateScrollToItem()` 은 애니메이션으로 이동합니다. 둘 다 suspend 함수라 코루틴에서 호출해야 합니다. androidx 소스에서 `rememberLazyListState` 는 `rememberSaveable` 과 `LazyListState` 전용 `Saver` 를 사용해 만들어지므로 첫 보이는 항목 인덱스와 오프셋이 저장 상태에 포함됩니다.

### 그리드

`LazyVerticalGrid` 와 `LazyHorizontalGrid` 는 `columns`/`rows` 파라미터에 `GridCells.Adaptive(minSize)` 또는 `GridCells.Fixed(n)` 를 받습니다. 가이드의 예시처럼 `item(span = { GridItemSpan(maxLineSpan) })` 로 한 줄을 모두 차지하는 항목을 만들 수 있습니다.

`LazyVerticalStaggeredGrid` 와 `LazyHorizontalStaggeredGrid` 는 항목마다 높이나 너비가 달라도 되는 그리드로, `StaggeredGridLayoutManager` 에 대응합니다. foundation 릴리스 노트로 보면 1.3.0 (2022년 10월 24일) 에서 실험적 API 로 도입됐고, 1.5.0-alpha04 (2023년 5월 10일) 노트에 "LazyStaggeredGrid APIs have been promoted to stable" 이라고 적혔으며, 1.5.0 은 2023년 8월 9일에 출시됐습니다.

### 항목 애니메이션

RecyclerView 가 어댑터 변경에 `ItemAnimator` 로 애니메이션을 입혔다면, Lazy 레이아웃은 항목 콘텐츠에 `Modifier.animateItem()` 을 붙입니다. 가이드는 위치 이동을 찾으려면 항목에 키가 있어야 한다고 거듭 강조합니다. 이력은 다음과 같습니다.

- 1.1.0-beta03 (2021년 11월 17일): 실험적 `Modifier.animateItemPlacement()` 가 `LazyItemScope` 에 추가됐습니다.
- 1.7.0-alpha06 (2024년 4월 3일): `LazyColumn`/`LazyRow` 에 항목 등장과 사라짐 애니메이션이 추가되면서, `animateItemPlacement()` 를 deprecated 로 하고 등장(fade in), 사라짐(fade out), 재배치 세 가지를 모두 다루는 비실험적 `Modifier.animateItem()` 이 도입됐습니다. 그리드와 staggered 그리드에는 1.7.0-alpha07 (2024년 4월 17일) 에서 같은 변경이 적용됐습니다.
- 1.7.0 (2024년 9월 4일): 위 변경이 안정 릴리스에 포함됐습니다.

`fadeInSpec`, `fadeOutSpec`, `placementSpec` 파라미터로 각 애니메이션의 스펙을 바꿀 수 있습니다.

### sticky header

`LazyListScope` 의 `stickyHeader` 는 이후 항목이 스크롤되는 동안에도 고정되는 헤더를 추가합니다. 레퍼런스에 따르면 다음 헤더가 올 때까지 고정되고, 레퍼런스에는 이 오버로드가 Added in 1.8.0 으로 표시돼 있습니다. `stickyHeader` 는 foundation 1.0.0-alpha10 (2021년 1월 13일) 에 실험적 API 로 처음 들어왔습니다. 1.8.0 에서 헤더 인덱스를 받는 지금의 오버로드가 추가됐고, 레퍼런스의 이 오버로드에는 실험적 표시가 없습니다. 그룹별 헤더는 가이드처럼 그룹 데이터를 ViewModel 에서 만들고 `forEach` 로 `stickyHeader` 와 `items` 를 번갈아 호출해서 구성합니다.

### Paging

Paging 3.0 이상은 `androidx.paging:paging-compose` 로 Compose 를 지원합니다. `Pager` 의 flow 에 `collectAsLazyPagingItems()` 를 호출하고, `itemCount` 와 `itemKey` 를 `items` 에 넘깁니다.

```kotlin
@Composable
fun MessageList(pager: Pager<Int, Message>) {
    val lazyPagingItems = pager.flow.collectAsLazyPagingItems()

    LazyColumn {
        items(
            lazyPagingItems.itemCount,
            key = lazyPagingItems.itemKey { it.id },
        ) { index ->
            val message = lazyPagingItems[index]
            if (message != null) MessageRow(message) else MessagePlaceholder()
        }
    }
}
```

가이드는 `RemoteMediator` 를 쓴다면 플레이스홀더 항목을 실제와 비슷한 크기로 두라고 경고합니다. 작은 플레이스홀더면 화면이 채워지지 않아 앱이 페이지를 계속 가져올 수 있기 때문입니다.

## 개념 대응표

공식 RecyclerView 이관 가이드는 LayoutManager 를 Lazy 컴포저블로, Adapter 의 `onCreateViewHolder()`·`onBindViewHolder()` 를 항목 컴포저블과 상태로 옮기라고 안내합니다. 가이드의 설명대로 Compose 에서는 "creating a composable for an item and binding data into it" 이 구분되지 않고 하나로 합쳐집니다. 같은 가이드는 `ItemAnimator` 에 대응하는 개념으로 `animateItemPlacement` modifier 를 드는데, 이 modifier 는 foundation 1.7.0 에서 deprecated 됐으므로 아래 그림과 표에는 후속 API 인 `Modifier.animateItem()` 을 적었습니다. `DiffUtil` 대응은 가이드에 없는 내용으로, 역할을 기준으로 덧붙였습니다.

![RecyclerView 의 Adapter, ViewHolder, DiffUtil, ItemDecoration, LayoutManager, ItemAnimator 가 각각 items DSL, 항목 Composable, key 와 상태, Arrangement 와 Divider, LazyColumn 계열, Modifier.animateItem 에 대응함을 보이는 다이어그램](@/assets/images/recyclerview-to-lazycolumn-mapping.png)

| RecyclerView              | Lazy 레이아웃                                         |
| ------------------------- | ----------------------------------------------------- |
| `Adapter`                 | `items { }` DSL 과 항목 람다                          |
| `ViewHolder`              | 항목 컴포저블                                         |
| `viewType`                | `contentType`                                         |
| `DiffUtil`, `ListAdapter` | `key` 와 목록 상태                                    |
| `ItemDecoration`          | `Arrangement.spacedBy`, 항목 안의 `HorizontalDivider` |
| `LayoutManager`           | `LazyColumn`, `LazyRow`, 그리드                       |
| `ItemAnimator`            | `Modifier.animateItem()`                              |
| `ConcatAdapter`           | 한 `LazyColumn` 안에 여러 `item`/`items`              |

`DiffUtil` 행에 대해 보면, Compose 에는 두 목록을 비교해 갱신 연산을 만드는 API 가 없고, 목록이 상태로 바뀌면 Lazy 레이아웃이 새 목록으로 다시 compose 되며 키가 기존 항목과 새 항목을 이어 줍니다. `ItemDecoration` 은 이관 가이드가 직접 "Compose does not have an equivalent concept of item decorations" 라고 쓰고, 장식을 composition 안에 직접 넣으라고 안내합니다. 간격은 가이드의 "Content spacing" 절처럼 `verticalArrangement = Arrangement.spacedBy(...)` 로 줍니다.

## 같은 목록의 before/after

메시지 목록을 구분선과 함께 보여 주고, 항목 유형을 view type 과 content type 으로 구분하는 같은 화면을 두 방식으로 작성합니다.

### RecyclerView

```kotlin
data class Message(val id: Long, val text: String, val type: Int)

class MessageAdapter : ListAdapter<Message, MessageAdapter.Holder>(Diff) {

    class Holder(view: View) : RecyclerView.ViewHolder(view) {
        val text: TextView = view.findViewById(R.id.text)
    }

    override fun getItemViewType(position: Int) = getItem(position).type

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_message, parent, false)
        return Holder(view)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        holder.text.text = getItem(position).text
    }

    private object Diff : DiffUtil.ItemCallback<Message>() {
        override fun areItemsTheSame(old: Message, new: Message) = old.id == new.id
        override fun areContentsTheSame(old: Message, new: Message) = old == new
    }
}

fun bindMessages(recyclerView: RecyclerView, messages: List<Message>) {
    val adapter = MessageAdapter()
    recyclerView.layoutManager = LinearLayoutManager(recyclerView.context)
    recyclerView.addItemDecoration(
        DividerItemDecoration(recyclerView.context, DividerItemDecoration.VERTICAL)
    )
    recyclerView.adapter = adapter
    adapter.submitList(messages)
}
```

### LazyColumn

```kotlin
@Composable
fun MessageList(messages: List<Message>, modifier: Modifier = Modifier) {
    LazyColumn(modifier) {
        itemsIndexed(
            items = messages,
            key = { _, message -> message.id },
            contentType = { _, message -> message.type },
        ) { index, message ->
            Column(Modifier.animateItem()) {
                Text(message.text)
                if (index != messages.lastIndex) HorizontalDivider()
            }
        }
    }
}
```

필요한 import 는 `androidx.compose.foundation.layout.Column`, `androidx.compose.foundation.lazy.LazyColumn`, `androidx.compose.foundation.lazy.itemsIndexed`, `androidx.compose.material3.HorizontalDivider`, `androidx.compose.material3.Text`, `androidx.compose.runtime.Composable`, `androidx.compose.ui.Modifier` 입니다. `Modifier.animateItem()` 은 `LazyItemScope` 의 멤버라 따로 import 하지 않습니다. 새 목록을 어댑터에 넘기는 `submitList` 호출은 사라지고, `messages` 가 상태에서 오기만 하면 값이 바뀔 때 목록이 다시 그려집니다. 이관 가이드의 구분선 예제도 마지막 항목 뒤에는 구분선을 넣지 않도록 `itemsIndexed` 를 사용합니다.

## 상호운용

두 시스템은 한 화면에 섞어 쓸 수 있습니다.

### Compose 안의 View

`AndroidView` 컴포저블로 View 계층을 Compose UI 에 넣습니다. 공식 문서에 따르면 `AndroidView` 는 View 를 돌려주는 `factory` 람다를 받습니다. `update` 콜백은 View 가 inflate 된 뒤 호출되고, 콜백 안에서 읽은 State 가 바뀌면 다시 호출됩니다. 문서는 View 를 `remember` 로 바깥에 들고 있지 말고 `factory` 안에서 만들라고 권하며, `AndroidView` 는 Compose 지원이 없는 구성 요소에만 쓰고 커스텀 View 는 가능하면 Compose 로 다시 작성하라고 덧붙입니다. Lazy 목록 항목 안에서 `AndroidView` 를 쓴다면 1.4.0-rc01 에 도입된 오버로드를 쓰라고 안내합니다. 이 오버로드는 Lazy 목록처럼 composition 이 재사용될 때 View 인스턴스도 함께 재사용하고, `onReset` 이 null 이 아니어야 재사용이 켜집니다. `onRelease` 는 View 가 다시 쓰이지 않고 composition 을 떠날 때 호출됩니다.

### RecyclerView 안의 Compose

RecyclerView 항목으로 Compose 를 넣을 때는 ViewHolder 의 View 로 `ComposeView` 를 씁니다. 이때 composition 이 언제 해제되는지가 `ViewCompositionStrategy` 로 결정됩니다. 공식 문서는 기본 전략 `DisposeOnDetachedFromWindowOrReleasedFromPool` 이 `ComposeView` 가 풀링 컨테이너(RecyclerView 같은) 안에 있지 않으면 창에서 분리될 때 composition 을 해제하고, 풀링 컨테이너 안이면 컨테이너 자체가 창에서 분리되거나 항목이 폐기될 때(풀이 가득 찼을 때) 해제한다고 설명합니다. 문서의 상호운용 시나리오 표에는 "`ComposeView` as an item in a pooling container such as `RecyclerView`" 가 이 전략의 항목으로 적혀 있습니다. 즉 RecyclerView 의 ViewHolder 안에서는 기본값을 그대로 쓰면 됩니다. 이 기본 동작은 Compose UI 1.2.0-beta02 이상과 RecyclerView 1.3.0 이상이 전제입니다. 기본 전략은 compose-ui 1.2.0-alpha06 (2022년 3월 23일) 에서 `DisposeOnDetachedFromWindowIfNotInPoolingContainer` 라는 이름으로 추가됐고, 1.2.0-beta02 (2022년 5월 18일) 에서 지금 이름으로 바뀌었습니다. RecyclerView 는 1.3.0-alpha02 에서 AndroidX PoolingContainer 라이브러리와 연동됐고, 1.3.0 릴리스 노트는 예전 상호운용 가이드의 `MyComposeAdapter` 와 `DisposeOnViewTreeLifecycleDestroyed` 조합을 쓰고 있었다면 제거하라고 안내합니다.

반대로 Fragment 의 View 안에 `ComposeView` 를 둘 때는 문서가 `DisposeOnViewTreeLifecycleDestroyed` 나 `DisposeOnLifecycleDestroyed` 를 안내합니다. 같은 문서가 점진적으로 Compose 를 도입하는 코드베이스에서는 기본 동작이 일부 상황에서 상태를 잃게 만들 수 있다고 경고합니다.

## 성능 관련 공식 권고

- **안정적이고 고유한 key**: Lists 가이드는 데이터가 바뀌어 항목 위치가 달라져도 `remember` 상태가 유지되도록 `key` 를 주라고 안내하고, 키 타입은 Activity 재생성 때 상태를 보존하는 `Bundle` 이 지원하는 타입이어야 한다고 적습니다. 성능 모범 사례 문서의 "Use lazy layout keys" 절은 안정적인 키를 주면 Compose 가 순서만 바뀐 항목을 다시 compose 하지 않아도 된다고 설명합니다.
- **`contentType`**: Lists 가이드는 여러 종류의 항목이 섞인 목록에 `contentType` 을 주면 같은 타입의 항목끼리만 composition 을 재사용하므로 재사용 효과와 Lazy 레이아웃 성능을 높일 수 있다고 설명합니다.
- **크기 0 항목 피하기**: 이미지를 비동기로 받는 경우처럼 항목 높이가 0 픽셀이면 Lazy 레이아웃이 첫 측정에서 모든 항목을 한꺼번에 compose 합니다. 가이드의 핵심 조언은 항목에 기본 크기를 지정해 Lazy 레이아웃이 화면에 들어가는 항목 수를 제대로 계산하게 하라는 것입니다.
- **같은 방향 스크롤 중첩 피하기**: 고정 크기가 없는 `LazyColumn` 을 세로 스크롤하는 `Column` 안에 넣으면 `IllegalStateException` 이 발생합니다. 가이드는 대신 부모 `LazyColumn` 하나에 DSL 로 여러 종류의 내용을 넣으라고 안내합니다.
- **측정 조건**: 가이드는 Lazy 레이아웃의 성능은 릴리스 모드와 R8 최적화를 켠 상태에서만 믿을 만하게 측정할 수 있고, 디버그 빌드에서는 스크롤이 더 느려 보일 수 있다고 말합니다.
- **Baseline Profile**: Compose 문서는 Baseline Profile 이 첫 실행부터 코드 실행 속도를 약 30% 높인다고 설명하고, Compose 라이브러리는 자체 프로필을 포함해 배포되지만 앱의 핵심 사용자 여정은 Macrobenchmark 로 앱 전용 프로필을 만들라고 안내합니다.

## View 기반 라이브러리의 maintenance mode

2026년 6월 16일 Android 개발자 블로그 글 "Android 17 is Here" 는 "Legacy View components (in the android.widget package) and View-based Jetpack libraries (like Fragments, RecyclerView, and ViewPager) are now in maintenance mode" 라고 적고, 이들이 치명적인 버그 수정만 받고 새 기능은 받지 않는다고 밝혔습니다. 같은 글은 앞으로 새 Android API, 라이브러리, 도구, 개발자 가이드를 Jetpack Compose 전용으로 만든다고 했습니다. 기존 RecyclerView 코드가 당장 동작하지 않게 되는 것은 아니고, 위 대응표는 이관할 때의 출발점으로 쓸 수 있습니다.

## 참고 자료

- [Create dynamic lists with RecyclerView (Android Developers)](https://developer.android.com/develop/ui/views/layout/recyclerview)
- [Support Library revisions, revision 21 (October 2014), Wayback Machine 보관본](https://web.archive.org/web/20141201000000/https://developer.android.com/tools/support-library/index.html)
- [Support Library Revision History, revision 24.2.0 (August 2016), Wayback Machine 보관본](https://web.archive.org/web/20161001000000/https://developer.android.com/topic/libraries/support-library/revisions.html)
- [Support Library Revision History, revision 27.1.0 (February 2018)](https://developer.android.com/topic/libraries/support-library/revisions)
- [Making ListView Scrolling Smooth, Wayback Machine 보관본](https://web.archive.org/web/2014/https://developer.android.com/training/improving-layouts/smooth-scrolling.html)
- [Adapter.getView (API reference)](https://developer.android.com/reference/android/widget/Adapter)
- [RecyclerView.Adapter (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/RecyclerView.Adapter)
- [RecyclerView.ItemDecoration (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/RecyclerView.ItemDecoration)
- [RecyclerView.ItemAnimator (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/RecyclerView.ItemAnimator)
- [RecyclerView.RecycledViewPool (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/RecyclerView.RecycledViewPool)
- [DiffUtil (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/DiffUtil)
- [ListAdapter (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/ListAdapter)
- [ConcatAdapter (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/ConcatAdapter)
- [RecyclerView release notes (AndroidX)](https://developer.android.com/jetpack/androidx/releases/recyclerview)
- [Lists and grids in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/lists)
- [Lists and grids in Compose, 2026-08-10 보관본](https://web.archive.org/web/20260810043817/https://developer.android.com/develop/ui/compose/lists)
- [Follow best practices, Compose performance, 2026-06-24 보관본](https://web.archive.org/web/20260624223946/https://developer.android.com/develop/ui/compose/performance/bestpractices)
- [Baseline Profiles and Compose (Android Developers)](https://developer.android.com/develop/ui/compose/performance/baseline-profiles)
- [Compose Foundation release notes (AndroidX)](https://developer.android.com/jetpack/androidx/releases/compose-foundation)
- [Compose UI release notes (AndroidX)](https://developer.android.com/jetpack/androidx/releases/compose-ui)
- [DividerItemDecoration (API reference)](https://developer.android.com/reference/androidx/recyclerview/widget/DividerItemDecoration)
- [LazyItemScope (API reference)](https://developer.android.com/reference/kotlin/androidx/compose/foundation/lazy/LazyItemScope)
- [LazyListScope (API reference)](https://developer.android.com/reference/kotlin/androidx/compose/foundation/lazy/LazyListScope)
- [LazyListState (API reference)](https://developer.android.com/reference/kotlin/androidx/compose/foundation/lazy/LazyListState)
- [Migrate RecyclerView to Lazy list (Android Developers)](https://developer.android.com/develop/ui/compose/migrate/migration-scenarios/recycler-view)
- [Migrate RecyclerView to Lazy list, 2026-05-19 보관본](https://web.archive.org/web/20260519181824/https://developer.android.com/develop/ui/compose/migrate/migration-scenarios/recycler-view)
- [Using Views in Compose (Android Developers)](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/views-in-compose)
- [Using Compose in Views, ViewCompositionStrategy (Android Developers)](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/compose-in-views)
- [Android 17 is Here (Android Developers Blog)](https://developer.android.com/blog/posts/android-17-is-here)
- [Android 17 is Here, 2026-09-14 보관본](https://web.archive.org/web/20260914145313/https://developer.android.com/blog/posts/android-17-is-here/)
