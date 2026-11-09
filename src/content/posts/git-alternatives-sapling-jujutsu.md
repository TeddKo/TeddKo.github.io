---
title: "git 이 불편해서가 아니라 스택 PR 때문에 jj 와 Sapling 을 열어 봤습니다"
description: "Jujutsu(jj), Meta 의 Sapling, Graphite·ghstack·git-branchless 같은 스택 도구를 plain git 과 비교했습니다. 데이터 모델, undo, 충돌 처리, 기존 GitHub 원격과의 호환, 팀 도입 비용을 명령어 대조표와 함께 정리했습니다."
pubDatetime: 2026-11-09T09:55:00+09:00
category: git
tags:
  - Git
  - Jujutsu
  - Sapling
  - 버전 관리
  - 스택 PR
---

앞선 [merge 냐 rebase 냐](/posts/git-merge-vs-rebase/) 글에서 스택 PR 을 `--update-refs` 로 한꺼번에 옮기는 방법을 적었습니다. 쓰다 보면 git 이 스택을 위해 만들어진 도구가 아니라는 사실이 계속 느껴집니다. 브랜치마다 이름을 붙여야 하고, 아래 커밋을 고치면 위 브랜치는 직접 따라가게 해야 하고, rebase 가 꼬이면 reflog 를 뒤져야 합니다. Android 앱을 만들면서 기능 하나를 모델, 도메인, UI 세 PR 로 쪼개 올리는 일이 흔한 저에게는 이 마찰이 꽤 큽니다.

그래서 git 을 대체하거나 그 위에 얹히는 도구들이 어떻게 같은 문제를 푸는지 정리해 봤습니다. 크게 둘로 나뉩니다. 저장소 모델 자체를 바꾼 **Jujutsu 와 Sapling**, 그리고 git 은 그대로 두고 스택 관리만 덧씌우는 **Graphite, ghstack, git-branchless** 입니다.

## 같은 작업을 세 가지 방식으로 보면

git 의 모델은 익숙합니다. 인덱스가 있고, 브랜치가 커밋을 가리키고, 지금 어느 브랜치에 있는지가 중요합니다. Jujutsu 는 여기서 세 가지를 바꿨습니다.

- **작업 디렉터리가 곧 커밋입니다.** 파일을 고치면 대부분의 `jj` 명령이 그 변경을 자동으로 커밋으로 만들어 이전 working-copy 커밋을 대체합니다. 인덱스(staging area)는 없고 stash 도 필요가 없어집니다.
- **change ID 가 커밋 ID 와 따로 있습니다.** 커밋을 재작성하면 해시(commit ID)는 새로 나오지만 change ID 는 보통 그대로입니다. rebase 하고 amend 해도 "이 변경"을 같은 이름으로 계속 가리킬 수 있습니다.
- **하위 커밋을 고치면 자손이 자동으로 rebase 됩니다.** 브랜치(jj 에서는 bookmark)도, 작업 중인 커밋도 같이 따라갑니다.

![git 은 인덱스와 브랜치가 커밋을 가리키는 구조이고, jj 는 작업 디렉터리 자체가 커밋이라 change ID 가 재작성 뒤에도 유지되고 자손이 자동으로 rebase 되며 operation log 가 모든 변경을 기록한다. 스택 도구는 브랜치와 PR 이 사슬로 이어진 구조를 git 위에서 관리한다](@/assets/images/git-alternatives-sapling-jujutsu-model.png)

jj 문서가 스스로 밝히는 영감의 출처가 재미있습니다. 인덱스 없음, revset, 익명 브랜치는 Mercurial 과 Sapling 에서, 충돌을 일급 객체로 다루는 건 Darcs 에서 가져왔다고 합니다. 자동 rebase 에 대해서는 `git rebase --update-refs` 와 `git rerere` 를 설계 차원에서 합쳐 놓은 것이라고 설명합니다. 제가 앞 글에서 손으로 하던 일을 기본 동작으로 넣은 셈입니다.

## Jujutsu

`jj` 의 최신 릴리스는 2026년 11월 5일에 나온 v0.47.1 입니다. 0.47.0 에서 Linux 빌드가 깨진 의존성 오류를 고친 패치입니다. 아직 1.0 이 아니고, README 도 스스로 "relatively young" 이라고 적습니다. 로드맵 문서에는 날짜를 붙일 수 없다고 명시되어 있습니다. 대부분의 기여자가 여가 시간에 참여하기 때문입니다.

### 저장소는 git 그대로

기본 백엔드는 일반 Git 저장소입니다. 그래서 동료는 내가 `git` CLI 를 쓰는지 모르는 채로 협업할 수 있습니다. 커밋과 파일만 Git 에 저장되고, bookmark 같은 상위 메타데이터는 Git 바깥의 별도 저장소에 들어갑니다. 인증과 원격 통신은 내부에서 `git` 을 사용합니다.

기존 git 저장소 안에서 `jj git init` 을 하면 `.jj` 와 `.git` 이 나란히 있는 colocated 작업 공간이 됩니다. 이 상태에서는 `jj` 명령을 실행할 때마다 Git 쪽 상태와 동기화되므로 `git` 과 `jj` 를 섞어 써도 됩니다. 점진적으로 갈아타 보기에 좋은 구조입니다. 한계도 문서에 분명히 나옵니다. Git hooks, `.gitattributes`, submodule, Git LFS 는 지원하지 않습니다. Android 프로젝트에서 pre-commit 훅으로 ktlint 를 돌리고 있다면 이 부분이 먼저 걸립니다.

### 충돌과 undo

jj 에서는 **충돌이 커밋에 기록됩니다.** rebase 가 충돌을 만들어도 명령은 성공하고, 충돌 상태가 그 커밋에 남습니다. `git rebase --continue` 같은 중간 상태가 없습니다. 충돌 난 커밋을 체크아웃해 풀고 amend 하면 그 해결이 자손 커밋으로 전파됩니다. 문서가 `git rerere` 의 대부분 용도를 대신한다고 설명하는 이유입니다. 지금 풀기 싫으면 충돌을 둔 채 다른 일을 해도 됩니다. rebase 도중 같은 지점에서 커밋마다 충돌을 다시 푸는 지루함이 이 구조에서는 사라집니다.

undo 는 operation log 가 맡습니다. reflog 가 ref 하나씩의 이력이라면 operation log 는 모든 ref 의 변경을 한 번에 원자적으로 기록합니다. 그래서 `jj undo` 한 번으로 방금 한 명령 전체를 되돌리고, `jj redo` 로 다시 적용하며, `jj op revert` 로 최근이 아닌 operation 도 되돌릴 수 있습니다. git 에는 대응하는 명령이 없다고 jj 의 명령 대조표에도 적혀 있습니다. rebase 가 이상하게 끝났을 때 reflog 에서 해시를 찾아 `reset --hard` 하던 경험이 있다면 이 차이가 크게 다가옵니다.

## Sapling

Sapling(`sl`)은 Meta 가 공개한 소스 컨트롤 시스템으로, 이름 그대로 Git 호환을 내세웁니다. CLI 는 Mercurial 에서 출발했고 UI 와 기능 일부를 공유합니다. 최신 릴리스 태그는 `0.2.20261103-145137+6282ac56`, 2026년 11월 4일입니다.

Sapling 이 jj 와 가장 다른 점은 **서버 쪽까지 포함한 시스템이라는 것**입니다. 대규모 저장소를 위한 서버 Mononoke 와 가상 파일시스템 EdenFS 가 같은 저장소에 있지만, README 는 두 가지 모두 외부 사용을 아직 지원하지 않는다고 적습니다. 우리가 실제로 쓰는 건 클라이언트 `sl` 입니다.

Git 저장소와 쓰는 방식은 두 가지입니다. `git clone` 으로 만든 `.git` 모드에서는 `git` 명령도 같이 쓸 수 있지만 두 도구를 섞으면 안 되는 경우가 있습니다. 예를 들어 `sl rebase` 가 중단됐으면 `git rebase --continue` 가 아니라 `sl rebase --continue` 를 써야 합니다. `sl clone` 으로 만든 `.sl` 모드는 `git` 명령을 지원하지 않습니다.

개념은 이렇습니다.

- 작업 중인 커밋은 **smartlog**(`sl` 만 입력해도 나옵니다)로 한눈에 봅니다. 아직 push 하지 않은 커밋과 main 의 위치, 그 사이의 그래프를 보여 줍니다.
- 스택 중간 커밋은 `rebase -i` 대신 그 커밋으로 `sl goto` 한 뒤 `sl amend`, `sl split`, `sl fold` 를 하면 됩니다. 위쪽 커밋은 자동으로 restack 됩니다. `sl absorb` 는 작업 중인 변경을 스택의 알맞은 커밋으로 흡수시킵니다.
- 커밋을 amend 하거나 rebase 하면 새 커밋이 옛 커밋에서 왔다는 기록이 남습니다. 스택 아래쪽 커밋이 서버에서 rebase 되어 main 에 들어가도, Sapling 이 로컬 1번 커밋이 main 의 X 가 됐다는 걸 알고 나머지를 자동으로 얹어 줍니다.
- 되돌리기는 `sl uncommit`, `sl unamend`, `sl unhide`, `sl undo` 로 나뉘어 있습니다.

GitHub 와는 `sl pr submit --stack` 으로 스택의 커밋마다 PR 을 만들거나 갱신합니다. 단, 각 PR 이 자기 커밋과 그 아래 모든 커밋을 포함하는 **겹치는** PR 이 됩니다. GitHub PR 화면에서는 이상하게 보이기 때문에 문서는 리뷰어가 ReviewStack(reviewstack.dev)을 쓰라고 권합니다. PR 주소의 도메인만 바꾸면 스택으로 보여 주는 도구입니다. 문서는 스스로 GitHub 의 PR UI 만큼 기능이 많거나 검증되지 않았다고 밝힙니다. 반대로 `sl push --to remote/branch` 로 브랜치만 올리고 GitHub 웹에서 PR 을 만드는 방법도 있는데, 그러면 브랜치당 PR 하나입니다.

## git 위에 얹는 스택 도구들

저장소 모델을 바꾸는 게 부담스러우면 git 은 두고 스택 관리만 맡기는 선택지가 있습니다.

**Graphite CLI(`gt`)** 는 브랜치 사이의 부모 관계를 기억하고 있다가 restack 합니다. `gt create` 로 현재 브랜치 위에 새 브랜치를 쌓고, `gt modify` 로 amend 하면 자손이 자동으로 restack 되며, `gt submit --stack` 이 스택 전체를 force push 하면서 PR 을 만들거나 갱신합니다. `gt sync` 는 trunk 를 당기고 머지된 브랜치를 정리하면서 restack 합니다. `gt undo` 도 있어서 Graphite 가 한 변경을 되돌릴 수 있습니다. 대상은 GitHub PR 이고, CLI 설치 뒤 인증 단계가 따로 있습니다. 내부는 평범한 git 브랜치라 팀원이 Graphite 를 쓰는지 몰라도 PR 은 정상으로 보입니다.

**ghstack** 은 Python 도구로 커밋 하나당 PR 하나를 만듭니다. 스택 커밋을 준비하고 `ghstack` 을 실행하면 PR 이 생기고, 커밋을 고친 뒤 다시 실행하면 갱신됩니다. 중간 커밋 수정은 `git rebase -i` 로 합니다. 역시 GitHub 전용이고 `.ghstackrc` 에 토큰을 넣어야 합니다.

**git-branchless** 는 git 을 확장하는 명령 모음입니다. `git undo`, 스마트로그, `git restack`, `git move`(서브트리 이동), `git sync`, `git next/prev` 를 제공하고 브랜치가 없는 작업 방식을 허용합니다. 최신 릴리스는 v0.11.1(2026년 5월 21일)입니다. 앞의 두 도구와 달리 PR 을 올려 주지는 않습니다.

그리고 순정 git 도 `--update-refs` 로 한 걸음 왔습니다. 앞 글에서 쓴 대로 `git rebase -i --update-refs main` 은 rebase 범위 안의 브랜치를 함께 옮깁니다. 새 도구 없이 이 옵션 하나만 알아도 스택 유지 비용이 꽤 내려갑니다.

## 명령어로 비교

같은 작업이 도구마다 어떻게 달라지는지 봅니다. a, b, c 세 변경이 쌓인 스택에서 b 를 고치고 올린다고 하겠습니다.

| 작업              | git                                                    | jj                        | sl                        | gt                             |
| ----------------- | ------------------------------------------------------ | ------------------------- | ------------------------- | ------------------------------ |
| 새 변경 시작      | `git switch -c b` 후 `git commit`                      | `jj new a` 후 `jj commit` | `sl commit`               | `gt create b`                  |
| 방금 변경에 amend | `git commit --amend -a`                                | `jj squash`               | `sl amend`                | `gt modify`                    |
| 중간 변경 수정    | `git commit --fixup=X` 후 `git rebase -i --autosquash` | `jj squash --into X`      | `sl goto X` 후 `sl amend` | `gt checkout b` 후 `gt modify` |
| 변경 이동         | `git rebase --onto B A^ 브랜치`                        | `jj rebase -s A -o B`     | `sl rebase -d B -r A::C`  | `gt move --onto B`             |
| 되돌리기          | `git reflog` 로 찾아 `git reset --hard`                | `jj undo`                 | `sl undo`                 | `gt undo`                      |
| 스택 올리기       | 브랜치마다 `git push --force-with-lease`               | `jj git push --all`       | `sl pr submit --stack`    | `gt submit --stack`            |

jj 열의 amend 는 설명이 필요합니다. jj 에서는 작업 디렉터리가 이미 커밋이라서, 파일을 고치면 그 커밋이 알아서 갱신됩니다. 위 `jj squash` 는 작업 디렉터리의 변경을 부모 변경으로 합치는 명령이고, 문서는 이를 `git commit --amend -a` 에 대응시킵니다. 같은 이유로 stash 는 `jj new @-` 로 새 변경을 시작하는 것으로 대신하는데, 문서에 따르면 옛 working-copy 커밋은 `jj edit` 으로 다시 열 수 있습니다. 한 가지 더, jj 의 push 는 bookmark 를 기준으로 하므로 미리 `jj bookmark create` 와 `jj bookmark track` 이 필요합니다. 이름을 만들고 싶지 않다면 `jj git push --change @-` 가 bookmark 이름을 자동으로 만들어 올립니다.

표의 `sl` 열에서 새 변경은 `sl commit` 하나가 전부입니다. 브랜치 이름이 필수가 아니기 때문입니다. 반대로 push 단계는 PR 이 겹쳐 보이는 문제를 감수해야 합니다.

![git, jj, Sapling, Graphite 를 데이터 모델, undo, 스택 변경, 충돌 처리, git 원격 호환, 팀 도입 비용의 여섯 기준으로 비교한 표](@/assets/images/git-alternatives-sapling-jujutsu-matrix.png)

## 기존 원격과의 호환, 그리고 팀에 들이는 비용

가장 먼저 확인할 건 서버 쪽에서 바뀌는 게 있느냐입니다. 네 도구 모두 **GitHub 나 GitLab, Bitbucket 에는 일반 git 저장소로 보입니다.** 서버에 설치할 것도, 원격 설정을 바꿀 것도 없습니다. 차이는 리뷰 단계에서 납니다. Graphite 와 ghstack 은 PR 을 직접 만들고, Sapling 은 겹치는 PR 을 만들고 ReviewStack 을 권하며, jj 는 아직 PR 을 만드는 기능이 없습니다. jj 로드맵에 `jj github submit` 같은 forge 연동을 만들고 싶다는 항목이 있는 걸로 보아 이 부분은 지금 직접 푸는 영역입니다. 업데이트도 `git pull` 에 해당하는 단일 명령이 없어서 `jj git fetch` 와 `jj rebase` 두 단계로 합니다.

팀 도입은 개인 도입과 완전히 다른 이야기입니다. 개인이 colocated jj 를 쓰는 건 팀에 알릴 필요조차 없습니다. 커밋과 브랜치는 git 객체로 나가니까요. 문제는 팀 전체가 쓸 때입니다. 훅이 안 돌고, CI 가 git 상태를 기대하고, 코드 리뷰 도구가 겹치는 PR 을 해석해야 합니다. Sapling 의 `.sl` 모드는 `git` 명령을 못 쓰는 환경이라 팀 도구와 충돌 가능성이 더 큽니다. 새로 배울 개념도 만만치 않습니다. 인덱스 없이 일하는 감각, change ID, revset, bookmark 를 직접 옮기는 일이 그렇습니다.

## 제가 고른다면

솔직히 아직 매일 쓰는 도구를 바꾸지는 않았습니다. Android 프로젝트는 Gradle 플러그인, 훅, CI 스크립트가 git 상태에 얽혀 있고 팀원들의 습관도 있습니다. 그래서 순서를 이렇게 잡았습니다.

1. 지금 당장은 `rebase.updateRefs true`, `--autosquash`, `--force-with-lease` 조합으로 순정 git 을 편하게 만듭니다.
2. 스택이 정말 깊어져 PR 이 자주 엮이면 Graphite 처럼 git 브랜치를 그대로 쓰는 도구를 써 봅니다. 팀원에게 아무것도 요구하지 않는다는 점이 큽니다.
3. 개인 로컬에서 실험하고 싶다면 colocated jj 가 가장 부담이 적습니다. 로컬에서만 써 보고 push 되는 건 git 커밋과 브랜치 그대로입니다.

제가 가장 끌리는 건 **undo 와 충돌을 미룰 수 있다는 점**입니다. 다만 실무에서 오래 써 본 게 아니라서 장점을 단정하지는 않겠습니다. 앞 글에서 "내 history 는 깨끗하게, 남의 history 는 건드리지 않고"라고 적은 원칙은 도구가 바뀌어도 그대로 유효합니다. 이 도구들이 해 주는 일은 그 원칙을 실수 없이 지키게 돕는 것이지, 원칙을 대체하는 게 아닙니다.

## 참고 자료

- [Jujutsu GitHub 저장소 README](https://github.com/jj-vcs/jj)
- [Jujutsu Releases (v0.47.1)](https://github.com/jj-vcs/jj/releases)
- [Jujutsu Docs: Comparison with Git](https://github.com/jj-vcs/jj/blob/main/docs/git-comparison.md)
- [Jujutsu Docs: Working copy](https://github.com/jj-vcs/jj/blob/main/docs/working-copy.md)
- [Jujutsu Docs: Operation log](https://github.com/jj-vcs/jj/blob/main/docs/operation-log.md)
- [Jujutsu Docs: First-class conflicts](https://github.com/jj-vcs/jj/blob/main/docs/conflicts.md)
- [Jujutsu Docs: Git compatibility](https://github.com/jj-vcs/jj/blob/main/docs/git-compatibility.md)
- [Jujutsu Docs: Using Jujutsu with GitHub and GitLab](https://github.com/jj-vcs/jj/blob/main/docs/github.md)
- [Jujutsu Docs: Glossary](https://github.com/jj-vcs/jj/blob/main/docs/glossary.md)
- [Jujutsu Docs: Roadmap](https://github.com/jj-vcs/jj/blob/main/docs/roadmap.md)
- [Sapling GitHub 저장소 README](https://github.com/facebook/sapling)
- [Sapling: Git cheat sheet](https://github.com/facebook/sapling/blob/main/website/docs/introduction/git-cheat-sheet.md)
- [Sapling: Differences from Git](https://github.com/facebook/sapling/blob/main/website/docs/introduction/differences-git.md)
- [Sapling: Git support modes](https://github.com/facebook/sapling/blob/main/website/docs/git/git_support_modes.md)
- [Sapling: Using Sapling with GitHub](https://github.com/facebook/sapling/blob/main/website/docs/git/github.md)
- [Sapling: ReviewStack](https://github.com/facebook/sapling/blob/main/website/docs/addons/reviewstack.md)
- [Graphite Docs: Command Reference](https://graphite.dev/docs/command-reference)
- [Graphite Docs: Command Cheatsheet](https://graphite.dev/docs/cheatsheet)
- [ghstack README](https://github.com/ezyang/ghstack)
- [git-branchless README](https://github.com/arxanas/git-branchless)
