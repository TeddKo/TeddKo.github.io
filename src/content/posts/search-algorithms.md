---
title: "선형·이진 탐색부터 BFS·DFS까지, 데이터 모양에 따라 고르는 탐색 (Kotlin)"
description: "선형 탐색, 이진 탐색(lower/upper bound 포함), 그래프 탐색 BFS·DFS 를 애니메이션과 Kotlin 코드로 보고, 복잡도와 선택 기준을 한 표로 비교합니다."
pubDatetime: 2025-02-18T20:30:00+09:00
category: algorithm
tags:
  - 탐색
  - 알고리즘
  - Kotlin
---

탐색 알고리즘을 고르는 기준은 사실 알고리즘이 아니라 데이터에 있습니다. 배열처럼 줄지어 있는지, 정렬되어 있는지, 그래프처럼 얽혀 있는지를 보면 쓸 수 있는 선택지가 거의 정해집니다. 앱 개발에서는 리스트에서 항목 하나를 찾거나 화면 간 이동 경로를 따라가는 일이 흔한데, 그럴 때 머릿속에 어떤 그림이 있느냐에 따라 코드가 꽤 달라집니다. 이번 글은 선형 탐색, 이진 탐색(lower/upper bound), BFS, DFS 를 차례로 보고 해시 기반 조회를 짧게 곁들입니다.

## 선형 탐색

처음부터 끝까지 하나씩 확인하는 방법입니다. 정렬이 필요 없다는 점이 장점입니다. 0번 인덱스부터 `arr[i] == target` 인지 보다가 같으면 `i` 를 반환합니다. 끝까지 없으면 `-1` 을 반환합니다.

아래 애니메이션은 `target = 41` 을 찾는 과정입니다. 보라색 테두리는 현재 확인 중인 칸입니다. 찾으면 그 칸이 보라색으로 채워집니다.

![선형 탐색 애니메이션: 인덱스 0 부터 한 칸씩 이동하며 값 41 을 찾을 때까지 비교하고 찾으면 해당 칸을 보라색으로 채운다](@/assets/images/search-linear.gif)

```kotlin
fun linearSearch(a: IntArray, target: Int): Int {
    for (i in a.indices) {
        if (a[i] == target) return i
    }
    return -1
}
```

| best         | average | worst | 공간 |
| ------------ | ------- | ----- | ---- |
| O(1) (첫 칸) | O(n)    | O(n)  | O(1) |

정렬되지 않았거나 데이터가 적다면 이걸로 충분합니다. 연결 리스트처럼 임의 접근이 안 되는 구조에서도 쓸 수 있습니다.

## 이진 탐색

정렬된 배열이라면 가운데 값과 비교해서 탐색 범위를 절반씩 버릴 수 있습니다. `lo = 0`, `hi = n - 1` 로 시작해 `mid = lo + (hi - lo) / 2` 를 구하고 `arr[mid]` 와 `target` 을 비교합니다. `arr[mid] < target` 이면 `lo = mid + 1`, `arr[mid] > target` 이면 `hi = mid - 1`, 같으면 찾은 것입니다. `lo > hi` 가 되면 값이 없다는 뜻입니다.

아래 애니메이션은 `target = 52` 입니다. 범위 밖이 된 칸은 흐리게 표시됩니다.

![이진 탐색 애니메이션: lo 와 hi 포인터가 좁혀지며 mid 값과 52 를 비교하고 범위의 절반이 흐려지다가 값을 찾는다](@/assets/images/search-binary.gif)

```kotlin
fun binarySearch(a: IntArray, target: Int): Int {
    var lo = 0
    var hi = a.lastIndex
    while (lo <= hi) {
        val mid = lo + (hi - lo) / 2
        when {
            a[mid] == target -> return mid
            a[mid] < target -> lo = mid + 1
            else -> hi = mid - 1
        }
    }
    return -1
}
```

`(lo + hi) / 2` 대신 `lo + (hi - lo) / 2` 를 쓰는 건 `lo + hi` 가 `Int` 범위를 넘는 오버플로를 피하기 위해서입니다.

| best | average  | worst    | 공간             |
| ---- | -------- | -------- | ---------------- |
| O(1) | O(log n) | O(log n) | O(1) (반복 구현) |

16개 원소라면 최대 5번, 100만 개라도 약 20번이면 끝납니다. 다만 정렬 비용(`O(n log n)`)이 먼저 필요하니 딱 한 번만 찾을 거라면 선형 탐색이 나을 수도 있습니다. 같은 데이터를 여러 번 조회할 때에야 이진 탐색이 이득입니다.

### lower bound 와 upper bound

값이 중복되어 있거나 "처음 나타나는 위치", "삽입 위치"가 필요하다면 경계 탐색을 씁니다. lower bound 는 `target` 이상인 첫 번째 인덱스, upper bound 는 `target` 초과인 첫 번째 인덱스입니다. 둘의 차 `upperBound - lowerBound` 가 곧 `target` 의 개수입니다. 탐색 구간을 `[lo, hi)` 의 반개구간으로 두면 경계 실수가 줄어듭니다.

```kotlin
fun lowerBound(a: IntArray, target: Int): Int {
    var lo = 0
    var hi = a.size
    while (lo < hi) {
        val mid = lo + (hi - lo) / 2
        if (a[mid] < target) lo = mid + 1 else hi = mid
    }
    return lo
}

fun upperBound(a: IntArray, target: Int): Int {
    var lo = 0
    var hi = a.size
    while (lo < hi) {
        val mid = lo + (hi - lo) / 2
        if (a[mid] <= target) lo = mid + 1 else hi = mid
    }
    return lo
}

// [1, 2, 2, 2, 5] 에서 2 -> lowerBound = 1, upperBound = 4, 개수 = 3
```

Kotlin 표준 라이브러리에도 `IntArray.binarySearch(target)`(JVM 한정)와 `List<T>.binarySearch(element)` 가 있습니다. 값이 없으면 `-(삽입 위치) - 1` 을 반환합니다. 중복 값이 있을 때는 어느 인덱스가 나올지 보장되지 않으니, 경계가 필요하면 위처럼 직접 구현해야 합니다.

## BFS 와 DFS

그래프는 노드(정점)와 간선으로 이루어진 구조입니다. 아래 8개 노드의 무방향 그래프를 인접 리스트로 표현해 두 알고리즘에 똑같이 적용해 보겠습니다.

```kotlin
val graph: List<List<Int>> = listOf(
    listOf(1, 2),       // 0
    listOf(0, 3, 4),    // 1
    listOf(0, 5, 6),    // 2
    listOf(1, 4),       // 3
    listOf(1, 3, 7),    // 4
    listOf(2, 7),       // 5
    listOf(2),          // 6
    listOf(4, 5),       // 7
)
```

두 탐색 모두 방문 체크를 빼먹으면 3-4-1 같은 사이클에서 끝나지 않고 돕니다. 구현할 때 제일 먼저 확인하는 부분입니다.

### BFS

BFS 는 시작 노드에서 가까운 노드부터 한 층씩 방문합니다. 구현에는 큐(FIFO)를 씁니다. 시작 노드를 큐에 넣고 방문 표시를 합니다. 그다음 큐에서 하나 꺼내 방문하고 꺼낸 노드의 방문하지 않은 이웃을 큐에 넣으면서 방문 표시를 합니다. 큐가 빌 때까지 이 과정을 반복합니다.

그래프 아래의 첫 줄이 큐, 그 아래 줄이 방문 순서입니다. 방문 순서는 `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7` 로, 시작점에서 가까운 순서입니다.

![BFS 애니메이션: 노드 0 에서 시작해 큐에서 노드를 꺼내 방문하고 방문하지 않은 이웃을 큐에 넣으며 층별로 퍼져 나간다](@/assets/images/search-bfs.gif)

```kotlin
fun bfs(graph: List<List<Int>>, start: Int): List<Int> {
    val visited = BooleanArray(graph.size)
    val order = mutableListOf<Int>()
    val queue = ArrayDeque<Int>()
    visited[start] = true
    queue.addLast(start)
    while (queue.isNotEmpty()) {
        val cur = queue.removeFirst()
        order += cur
        for (next in graph[cur]) {
            if (!visited[next]) {
                visited[next] = true
                queue.addLast(next)
            }
        }
    }
    return order
}
```

가중치가 없는 그래프에서 간선 수 기준 최단 경로를 구할 수 있다는 점이 BFS 의 가장 큰 용도입니다. 방문 표시를 큐에 넣을 때 한다는 점은 신경 써야 합니다. 꺼낼 때 하면 같은 노드가 큐에 중복으로 들어갑니다. 꺼낸 노드가 이미 방문한 것이면 건너뛰는 검사를 따로 넣어야 결과가 같고, 그래도 큐는 커집니다.

### DFS

DFS 는 한 방향으로 갈 수 있는 끝까지 들어갔다가 막히면 되돌아옵니다. 재귀(콜 스택)나 명시적 스택(LIFO)으로 구현합니다. 현재 노드를 방문 표시하고 처리한 다음, 방문하지 않은 이웃 중 하나로 재귀 호출합니다. 더 갈 곳이 없으면 호출이 끝나면서 이전 노드로 돌아오는데, 이것이 백트래킹입니다.

그래프 아래의 첫 줄은 콜 스택(현재 경로)입니다. 방문 순서는 `0 → 1 → 3 → 4 → 7 → 5 → 2 → 6` 으로 BFS 와 확연히 다릅니다.

![DFS 애니메이션: 노드 0 에서 시작해 1, 3, 4, 7, 5, 2, 6 순으로 깊이 들어가며 콜 스택에 쌓이고 막히면 되돌아온다](@/assets/images/search-dfs.gif)

```kotlin
fun dfs(graph: List<List<Int>>, start: Int): List<Int> {
    val visited = BooleanArray(graph.size)
    val order = mutableListOf<Int>()

    fun visit(cur: Int) {
        visited[cur] = true
        order += cur
        for (next in graph[cur]) {
            if (!visited[next]) visit(next)
        }
    }

    visit(start)
    return order
}
```

노드가 수만 개 이상이고 경로가 깊으면 재귀가 `StackOverflowError` 를 일으킬 수 있습니다. 그럴 때는 명시적 스택으로 바꿉니다.

```kotlin
fun dfsIterative(graph: List<List<Int>>, start: Int): List<Int> {
    val visited = BooleanArray(graph.size)
    val order = mutableListOf<Int>()
    val stack = ArrayDeque<Int>()
    stack.addLast(start)
    while (stack.isNotEmpty()) {
        val cur = stack.removeLast()
        if (visited[cur]) continue
        visited[cur] = true
        order += cur
        for (next in graph[cur].asReversed()) {
            if (!visited[next]) stack.addLast(next)
        }
    }
    return order
}
```

이웃을 `asReversed()` 로 넣는 이유는 재귀 버전과 방문 순서를 맞추기 위해서입니다. 순서가 상관없다면 그냥 넣어도 됩니다. 이 방식은 같은 노드가 스택에 여러 번 들어갈 수 있어서 스택 크기가 최악 `O(E)` 입니다.

### 복잡도

| 알고리즘 | 시간     | 공간                                      | 자료구조    |
| -------- | -------- | ----------------------------------------- | ----------- |
| BFS      | O(V + E) | O(V)                                      | 큐          |
| DFS      | O(V + E) | O(V) (재귀) / O(V + E) (명시적 스택 구현) | 스택 / 재귀 |

`V` 는 노드 수, `E` 는 간선 수입니다. 인접 리스트로 표현하면 모든 노드를 한 번, 간선을 (무방향이면 양쪽에서) 상수 번만 보기 때문에 이렇게 됩니다. 인접 행렬이면 `O(V²)` 입니다.

## 해시 기반 조회

값으로 바로 찾아야 한다면 정렬도 순회도 필요 없는 해시 테이블이 있습니다. Kotlin 의 `HashMap`/`HashSet` 은 키의 해시 코드로 위치를 계산해서 평균 `O(1)` 에 조회합니다. `mutableMapOf`, `mutableSetOf` 의 기본 구현은 `LinkedHashMap`/`LinkedHashSet` 입니다.

```kotlin
val seen = hashSetOf(3, 8, 12, 17)
println(12 in seen) // true
```

해시 충돌이 많으면 최악 `O(n)` 까지 느려질 수 있습니다. JDK 8 이후 `HashMap` 은 충돌이 심한 버킷을 트리로 바꿔서, 키가 `Comparable` 이면 `O(log n)` 으로 완화합니다. 대신 정렬 순서나 범위 조회(`lowerBound` 같은 것)는 지원하지 않습니다. 범위 조회가 필요하면 정렬된 배열과 이진 탐색, 아니면 `TreeMap` 이 맞습니다.

## 한 표로 비교

| 방법      | 전제 조건      | 시간 (평균) | 시간 (최악) | 공간                      | 적합한 경우                   |
| --------- | -------------- | ----------- | ----------- | ------------------------- | ----------------------------- |
| 선형 탐색 | 없음           | O(n)        | O(n)        | O(1)                      | 적은 데이터, 비정렬           |
| 이진 탐색 | 정렬된 배열    | O(log n)    | O(log n)    | O(1)                      | 반복 조회, 경계/범위          |
| 해시 조회 | 해시 가능한 키 | O(1)        | O(n)        | O(n) (테이블 자체)        | 키 → 값 매핑, 존재 확인       |
| BFS       | 그래프         | O(V + E)    | O(V + E)    | O(V)                      | 최단 거리(간선 수), 레벨 순회 |
| DFS       | 그래프         | O(V + E)    | O(V + E)    | O(V) 재귀 / O(V + E) 스택 | 경로 존재, 사이클, 백트래킹   |

## 마치며

고르는 순서는 간단합니다. 정렬되지 않은 소량 데이터면 선형 탐색, 정렬되어 있고 자주 조회한다면 이진 탐색, 키로 바로 찾는다면 해시입니다. 이진 탐색은 `lo`/`hi`/`mid` 경계 처리에서 실수가 나기 쉬우니 중복이나 삽입 위치가 필요할 때는 lower/upper bound 를 구현해 두면 편합니다.

그래프라면 가까운 것부터 봐야 할 때(최단 거리) BFS, 끝까지 파고들어야 할 때(경로·사이클·백트래킹) DFS 입니다. 어느 쪽이든 방문 체크가 빠지면 사이클에서 끝나지 않으니 제일 먼저 확인하세요.

## 참고 자료

- [Kotlin binarySearch](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/binary-search.html)
- [Kotlin ArrayDeque](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.collections/-array-deque/)
- [Arrays.binarySearch (Java SE 17)](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Arrays.html#binarySearch(int%5B%5D,int)>)
- [TreeMap (Java SE 17)](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/TreeMap.html)
- [HashMap (Java SE 17)](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/HashMap.html)
