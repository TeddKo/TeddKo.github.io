---
title: "merge 냐 rebase 냐, 제 브랜치와 공유 브랜치를 나눠서 생각합니다"
description: "git merge 와 rebase 가 history 에 남기는 모양, fast-forward 와 squash, rebase -i, --update-refs, force push 안전장치, revert 와 bisect 에 미치는 영향, GitHub 과 GitLab 의 머지 방식까지 한 번에 정리했습니다."
pubDatetime: 2026-11-09T09:27:00+09:00
category: git
tags:
  - Git
  - merge
  - rebase
  - 협업
  - 버전 관리
---

팀마다 "우리는 rebase 합니다", "우리는 squash 만 씁니다" 같은 규칙이 하나씩 있습니다. 규칙을 따르다 보면 이유를 모르고 쓰게 되는데, 이유는 결국 **커밋 해시가 바뀌느냐 안 바뀌느냐**로 거의 다 설명됩니다. merge 는 기존 커밋을 건드리지 않고 합치는 커밋을 하나 더 만듭니다. rebase 는 내 커밋을 다른 지점 위에 복사해서 다시 만들고 원래 것은 버립니다. 이 차이가 force push, 충돌 해결, revert, 협업 규칙까지 이어집니다.

저는 업무에서 PR 을 여러 개 이어 붙인 스택 구조로 작업하는 일이 많아서 rebase 를 매일 쓰는 편입니다. 그래도 공유 브랜치 앞에서는 merge 쪽으로 마음이 기웁니다. 왜 그런지 순서대로 적어 보겠습니다.

## 같은 상황에서 세 가지 결과

기준 상태는 이렇습니다. `feature` 는 O 에서 갈라져 A, B 두 커밋을 쌓았고, 그 사이 `main` 에도 C, D 가 쌓였습니다. 해시는 설명용 가짜 값입니다.

```text
* b2b2b2b (feature) B
* a1a1a1a A
| * d4d4d4d (HEAD -> main) D
| * c3c3c3c C
|/
* 0000000 O
```

`main` 에서 `git merge feature` 를 하면 합치는 커밋이 하나 생깁니다.

```text
*   e5e5e5e (HEAD -> main) Merge branch 'feature'
|\
| * b2b2b2b (feature) B
| * a1a1a1a A
* | d4d4d4d D
* | c3c3c3c C
|/
* 0000000 O
```

`e5e5e5e` 는 부모가 둘입니다. 첫 번째 부모는 합치기 전의 `main`(D), 두 번째 부모는 합쳐 들어온 `feature`(B)입니다. A 와 B 의 해시는 그대로이고 갈라졌다 합쳐진 모양이 기록에 남습니다.

반대로 `feature` 에서 `git rebase main` 을 하면 A 와 B 가 D 위에서 다시 만들어집니다.

```text
* f7f7f7f (HEAD -> feature) B
* f6f6f6f A
* d4d4d4d (main) D
* c3c3c3c C
* 0000000 O
```

내용은 같은 A, B 인데 부모가 달라졌으니 해시도 새로 나왔습니다. 이후 `main` 에서 `git merge feature` 를 하면 `main` 이 `feature` 의 조상이라서 포인터만 앞으로 옮기는 fast-forward 가 됩니다. 옛 `a1a1a1a`, `b2b2b2b` 는 어느 브랜치에서도 가리키지 않지만 `git reflog` 에는 한동안 남아 있어서 실수했을 때 되돌릴 수 있습니다.

squash merge 는 `git merge --squash feature` 후 `git commit` 입니다. 문서 표현을 빌리면 merge 가 일어난 것과 같은 작업 트리와 인덱스 상태를 만들되 커밋, `HEAD` 이동, `MERGE_HEAD` 기록은 하지 않습니다. 그래서 직접 커밋한 결과는 부모가 하나인 커밋 하나입니다.

```text
* 9c9c9c9 (HEAD -> main) feature 작업 전체
* d4d4d4d D
* c3c3c3c C
* 0000000 O
```

![같은 출발 상태에서 merge 는 부모가 둘인 M 커밋을 만들고, rebase 는 A 와 B 를 D 위에 A' 와 B' 로 다시 만들어 한 줄로 이으며, squash merge 는 A 와 B 의 변경을 합친 커밋 S 하나만 main 에 붙인다](@/assets/images/git-merge-vs-rebase-graph.png)

## fast-forward 와 --no-ff

`git merge` 는 기본값이 `--ff` 입니다. 합칠 대상이 현재 브랜치의 자손이면 merge 커밋 없이 포인터만 옮기고, 그렇지 않을 때만 merge 커밋을 만듭니다. `--no-ff` 는 fast-forward 가 가능해도 무조건 merge 커밋을 만들고, `--ff-only` 는 fast-forward 가 안 되면 아예 합치기를 거부합니다. 설정으로는 `merge.ff` 에 `false` 나 `only` 를 줄 수 있습니다.

```bash
git merge --no-ff feature     # 합류 지점을 커밋으로 남김
git merge --ff-only feature   # 갈라졌으면 실패, 먼저 rebase 하라는 신호
```

`--no-ff` 의 쓸모는 "여기서 이 기능이 들어왔다"는 표식이 history 에 남는다는 점입니다. 브랜치 하나를 통째로 되돌리거나 훑어볼 때 그 merge 커밋이 손잡이 역할을 합니다. 반대로 선형 history 를 원하는 팀은 `--ff-only` 로 막아 두고 rebase 를 강제합니다.

## rebase -i 로 커밋 정리하기

PR 을 올리기 전에 커밋을 다듬을 때 쓰는 도구입니다. `git rebase -i main` 을 열면 todo 목록이 나옵니다.

```text
pick   a1a1a1a 로그인 화면 추가
fixup  e8e8e8e 오타 수정
reword b2b2b2b 토큰 갱신 처리
```

`pick` 은 그대로 두기, `reword` 는 메시지만 고치기, `squash` 는 앞 커밋에 합치되 메시지를 합쳐서 편집하기, `fixup` 은 앞 커밋에 합치되 메시지는 버리기입니다. 서로 작성자가 다른 커밋을 합치면 첫 커밋의 작성자로 기록된다는 점은 알아 둘 만합니다.

저는 `--autosquash` 와 같이 쓰는 방식을 선호합니다. 리뷰 반영처럼 앞선 커밋을 고치는 커밋을 만들 때 이렇게 합니다.

```bash
git commit --fixup=a1a1a1a
git rebase -i --autosquash main
```

`fixup! 로그인 화면 추가` 같은 제목의 커밋이 생기고, `--autosquash` 는 이런 커밋을 대상 커밋 바로 뒤로 옮겨서 `fixup` 으로 바꿔 줍니다. `rebase.autoSquash` 를 `true` 로 두면 `-i` 에서 기본 동작이 됩니다. 리뷰어가 보는 중간 커밋을 지저분하게 만들지 않고 수정을 얹을 수 있어서 편합니다.

## 스택 PR 과 --update-refs

PR 을 `a` → `b` → `c` 순서로 쌓아 두었다고 합시다. `main` 이 움직여서 `c` 를 rebase 하면 `a`, `b` 브랜치 포인터는 옛 커밋에 그대로 남습니다. 예전에는 브랜치마다 `rebase --onto` 를 따로 돌려야 했습니다.

Git 2.38 릴리스 노트에 `git rebase -i` 가 `--update-refs` 옵션으로 rebase 대상 범위 안에 있는 브랜치를 함께 옮기게 되었다고 나옵니다. 문서의 설명은 rebase 되는 커밋을 가리키는 브랜치를 자동으로 강제 갱신한다는 것이고, 워크트리에 체크아웃된 브랜치는 갱신하지 않습니다.

```bash
git switch c
git rebase -i --update-refs main
```

todo 목록에 `update-ref refs/heads/a`, `update-ref refs/heads/b` 같은 줄이 끼어 나오고, 끝나면 세 브랜치가 모두 새 main 위로 옮겨 가 있습니다. `rebase.updateRefs` 를 `true` 로 두면 기본값이 됩니다. 스택 구조로 일하는 입장에서는 이 옵션을 알고 나서 손이 훨씬 덜 갑니다. 다만 브랜치를 옮기고 나면 각각 원격에 force push 해야 한다는 점은 그대로입니다.

## pull 도 merge 이거나 rebase 입니다

`git pull` 은 fetch 다음에 합치기를 합니다. 문서의 `--rebase` 옵션 설명대로, `true` 면 가져온 upstream 위에 내 브랜치를 rebase 하고 `false` 면 upstream 을 현재 브랜치로 merge 하며, `merges` 는 `--rebase-merges` 로 로컬 merge 커밋을 보존하고 `interactive` 는 인터랙티브 모드로 돌립니다.

```bash
git pull --rebase
git config --global pull.rebase true
```

로컬에서 커밋 하나 했을 뿐인데 `git pull` 이 `Merge branch 'main' of ...` 커밋을 만드는 경험은 흔합니다. 그런 의미 없는 merge 커밋이 싫다면 `pull.rebase true` 가 답이고, 로컬이 갈라졌을 때 아무것도 하지 않고 실패하게 하려면 `git pull --ff-only` 도 있습니다. 문서에는 `--rebase` 가 "잠재적으로 위험한" 모드이며, 이미 공개한 history 를 다시 쓰면 좋지 않으니 `git rebase` 문서를 읽고 쓰라는 경고도 적혀 있습니다.

## 충돌은 어떻게 다른가

merge 는 양쪽 끝점만 비교해서 한 번에 충돌을 보여 줍니다. 최종 결과만 맞으면 됩니다. rebase 는 커밋을 하나씩 다시 적용하기 때문에, 같은 줄을 여러 커밋이 건드렸다면 **같은 지점의 충돌을 커밋마다 반복해서** 만날 수 있습니다. 커밋이 열 개인 브랜치에서 한 파일이 계속 부딪히면 꽤 지칩니다.

그럴 때를 위해 `rerere`(reuse recorded resolution)가 있습니다. 충돌을 해결한 방식을 기록해 두었다가 같은 충돌이 다시 나오면 자동으로 적용해 줍니다.

```bash
git config rerere.enabled true
```

켜 두면 `merge`, `commit`, `rebase` 가 알아서 호출합니다. 적용 결과는 작업 트리에만 반영되고 인덱스는 건드리지 않아서, `git diff` 로 확인하고 `git add` 해야 합니다. 문서가 드는 대표 사례는 긴 topic 브랜치에서 최신 main 으로 시험 삼아 merge 해 충돌을 풀어 둔 뒤 그 merge 를 버리고, 나중에 같은 충돌을 rebase 에서 다시 만나는 경우입니다. 오래 사는 브랜치를 rebase 로 따라가게 한다면 켜 둘 가치가 있습니다.

squash 쪽이 편한 이유도 여기서 보입니다. 열 커밋이 아니라 합쳐진 결과 하나만 기준 브랜치와 맞추면 되니 충돌을 한 번만 풉니다.

## 황금률: 공유한 history 는 다시 쓰지 않는다

rebase 문서에는 이런 경고가 있습니다. 다른 사람이 작업을 얹은 브랜치를 rebase 하거나 어떤 식으로든 다시 쓰는 것은 나쁜 생각이고, 그 하위에서 일하던 사람은 자기 history 를 손으로 고쳐야 한다는 내용입니다. 해결법도 같이 적혀 있습니다. upstream 이 rebase 된 경우에는 `git rebase --onto 새기준 옛기준` 으로 어디까지가 옛 기준인지를 알려 줘야 하고, 이때 `rebase -i` 로 지웠던 커밋이 되살아날 수 있다고 직접 주의를 줍니다. 결론은 애초에 upstream 을 rebase 하지 않는 것이 진짜 해결책이라는 말입니다.

제 기준은 단순합니다. **내 브랜치 하나에 나만 push 한다면 마음껏 rebase 합니다.** 둘 이상이 같은 브랜치에 push 하거나 다른 브랜치의 기반이 되고 있다면, 그때부터는 merge 만 씁니다. 스택 PR 도 위 브랜치가 아래 브랜치에 기대고 있어서 이 규칙이 적용되는 구간이 있으니 `--update-refs` 로 한꺼번에 옮기고 같이 올려야 합니다.

## force push 는 --force-with-lease 로

rebase 한 브랜치를 이미 push 했다면 원격이 앞서 있으니 일반 push 는 거절당하고 force push 가 필요합니다. 그냥 `--force` 는 문서 표현 그대로 `--force-with-lease` 를 포함한 다른 안전 검사를 모두 끄고, 원격이 커밋을 잃을 수 있습니다.

```bash
git push --force-with-lease origin feature
```

`--force-with-lease` 는 원격 브랜치의 현재 값이 내가 가진 remote-tracking 브랜치와 같을 때만 덮어씁니다. 내가 마지막으로 본 이후에 다른 사람이 push 했으면 실패합니다. 문서가 단서를 하나 답니다. 값을 명시하지 않은 형태는 백그라운드에서 몰래 `git fetch` 를 돌리는 도구와 궁합이 아주 나쁩니다. IDE 의 자동 fetch 가 remote-tracking 브랜치를 최신으로 바꿔 놓으면, 내가 보지 못한 커밋이 있는데도 lease 검사가 통과해 버립니다.

이 구멍을 막는 옵션이 `--force-if-includes` 입니다. remote-tracking 브랜치의 끝이 로컬 브랜치의 reflog 항목에서 도달 가능한지 확인해서, 원격 변경을 내가 로컬에 통합한 적이 없으면 거절합니다.

```bash
git push --force-with-lease --force-if-includes origin feature
git config --global push.useForceIfIncludes true
```

`push.useForceIfIncludes` 를 켜 두면 매번 붙이지 않아도 됩니다. 문서에 따르면 `--force-with-lease=<ref>:<expect>` 처럼 기대값을 직접 준 경우에는 이 옵션이 아무 일도 하지 않습니다.

## bisect, blame, revert

rebase 로 정리한 선형 history 는 커밋 하나가 곧 변경 하나라서 `git bisect` 로 범인을 좁히기 쉽고, 결함이 있는 커밋만 `git revert` 하면 됩니다. 다만 rebase 로 쌓은 커밋 중간이 빌드되지 않는 상태라면 bisect 가 엉뚱한 곳에서 멈춥니다. 커밋마다 빌드가 되도록 정리하는 습관이 같이 가야 합니다.

merge 커밋을 되돌릴 때는 `-m` 이 필요합니다. 부모가 둘이라서 어느 쪽이 본류인지 git 이 알 수 없기 때문입니다.

```bash
git revert -m 1 e5e5e5e
```

부모 번호는 1 부터 시작하고, 보통은 합치기 전의 main 쪽인 1 을 줍니다. 문서에는 한 가지 더 중요한 경고가 있습니다. merge 를 revert 하면 그 merge 로 들어온 변경을 앞으로 원하지 않는다고 선언하는 셈이라, 이후 같은 브랜치를 다시 merge 해도 되돌린 merge 의 조상이 아닌 커밋의 변경만 들어옵니다. 고친 뒤 다시 합치려면 revert 자체를 revert 하는 식으로 풀어야 해서, 처음 겪으면 꽤 당황스럽습니다.

squash merge 는 반대로 revert 가 제일 쉽습니다. 커밋 하나만 되돌리면 PR 전체가 사라집니다. 그 대신 `git blame` 으로 한 줄의 이력을 따라가면 "feature 작업 전체"라는 큰 커밋에 닿고, 세부 의도를 알아내려면 PR 설명을 열어야 합니다. 커밋 메시지에 PR 번호와 요약을 잘 남기는 팀이면 크게 문제되지 않습니다.

## 팀 정책과 GitHub, GitLab 의 머지 방식

결국 팀 규칙으로 드러나는 곳은 PR 머지 버튼입니다. GitHub 은 세 가지를 제공합니다.

- **Merge commit**: 모든 커밋이 `--no-ff` 로 merge 커밋과 함께 들어옵니다. 그 자체로는 선형 history 가 되지 않습니다.
- **Squash and merge**: PR 의 커밋을 하나로 합쳐 fast-forward 로 넣습니다. 문서가 밝히는 단점은 원래 커밋의 시간과 작성 정보를 잃는다는 점, 같은 브랜치로 계속 작업해 새 PR 을 열면 이미 squash 된 커밋이 다시 나타나 같은 충돌을 반복해서 풀 수 있다는 점, 원래 커밋 SHA 가 사라져 `git rerere` 같은 도구의 효과가 떨어질 수 있다는 점입니다.
- **Rebase and merge**: 각 커밋을 merge 커밋 없이 하나씩 얹습니다. 선형이 되지만 새 커밋으로 history 를 다시 쓰는 방식이고, 로컬에서 `git rebase` 한 것과는 다릅니다. 언제나 committer 정보를 갱신하고 새 SHA 를 만들며, 처음부터 비어 있던 커밋은 버립니다. 이렇게 추가된 커밋은 서명 검증도 되지 않습니다.

GitLab 도 merge commit, 가능할 때만 merge 커밋을 만드는 semi-linear history, merge 커밋 없는 fast-forward merge 를 고를 수 있고, squash 는 허용 안 함, 허용, 권장, 필수의 네 단계로 나뉩니다. 문서가 각각을 `git merge --no-ff`, `--ff-only` 에 대응시키는 설명을 보면 지금까지 본 옵션이 그대로 버튼이 된 셈입니다.

선형 history 를 강제하고 싶다면 GitHub 보호 브랜치에 선형 history 필수 규칙을 걸 수 있습니다. 그러면 merge 커밋을 push 할 수 없고 squash 나 rebase and merge 만 가능해집니다.

![merge, rebase, squash merge 를 history 모양, 커밋 해시, 충돌 처리, 공유 브랜치 안전성, bisect 와 revert, 잘 맞는 곳의 여섯 기준으로 비교한 표](@/assets/images/git-merge-vs-rebase-matrix.png)

## 제가 쓰는 조합

팀에 정해진 규칙이 있으면 그걸 따르는 게 맞습니다. 정하는 입장이라면 저는 이렇게 가겠습니다. 작업 중인 개인 브랜치는 `pull --rebase` 와 `rebase -i --autosquash` 로 자주 정리하고, push 는 `--force-with-lease` 로만 합니다. main 으로 들어갈 때는 PR 하나를 커밋 하나로 남기는 squash 를 기본으로 하되, 여러 사람이 오래 같이 일한 큰 브랜치는 merge 커밋으로 합류 지점을 남깁니다.

**rebase 는 내 history 를 깨끗하게 만드는 도구이고, merge 는 남의 history 를 건드리지 않고 합치는 도구**라고 생각하면 갈림길이 대부분 정리됩니다. 어느 쪽이든 실수했을 때 `git reflog` 로 돌아갈 수 있다는 것만 기억해 두면 rebase 가 그렇게 무섭지는 않습니다.

## 참고 자료

- [git-merge Documentation](https://git-scm.com/docs/git-merge)
- [git-rebase Documentation](https://git-scm.com/docs/git-rebase)
- [git-push Documentation](https://git-scm.com/docs/git-push)
- [git-pull Documentation](https://git-scm.com/docs/git-pull)
- [git-revert Documentation](https://git-scm.com/docs/git-revert)
- [git-rerere Documentation](https://git-scm.com/docs/git-rerere)
- [Git v2.38.0 Release Notes](https://raw.githubusercontent.com/git/git/master/Documentation/RelNotes/2.38.0.adoc)
- [GitHub Docs: About merge methods on GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github)
- [GitLab Docs: Merge methods](https://docs.gitlab.com/user/project/merge_requests/methods/)
