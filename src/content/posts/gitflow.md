---
title: "Git Flow 는 아직 쓸 만합니다, 다만 맞는 제품이 따로 있습니다"
description: "Vincent Driessen 의 Git Flow 브랜치 모델을 main, develop, feature, release, hotfix 브랜치의 흐름과 명령어로 따라가 보고, GitHub Flow, GitLab Flow, trunk-based development 와 비교해 어떤 팀과 제품에 맞는지 정리했습니다."
pubDatetime: 2026-11-09T11:44:00+09:00
category: git
tags:
  - Git
  - Git Flow
  - 브랜치 전략
  - 협업
  - 릴리스
---

"우리 팀은 Git Flow 를 씁니다"라는 말은 팀마다 뜻이 조금씩 다릅니다. develop 브랜치가 있다는 정도로 쓰는 팀도 있고, release 와 hotfix 까지 원문 그대로 지키는 팀도 있습니다. 반대로 "Git Flow 는 낡았다"는 말도 자주 나옵니다. 그런데 원문을 쓴 사람이 직접 한계를 적어 두었고, 그 한계가 어디까지인지를 알고 나면 둘 다 반만 맞는 말입니다.

저는 Android 앱을 만드는 입장이라 이 모델이 가장 잘 맞는 쪽과 가장 무거운 쪽을 모두 겪어 봤습니다. 브랜치가 어떻게 흘러가는지 명령어로 한 번 따라가 보고, 다른 전략과 나란히 놓아 보겠습니다.

## 어디서 나온 모델인가

출처는 Vincent Driessen 이 2010년 1월 5일에 올린 "A successful Git branching model" 이라는 글입니다. 이후 널리 퍼져서 많은 팀이 사실상 표준처럼 받아들였습니다.

같은 글 맨 위에는 2020년 3월 5일자 "note of reflection" 이 붙어 있습니다. 모델이 나온 지 10년이 넘었고, 그 사이 Git 으로 만드는 소프트웨어의 주류가 웹 앱이 되었으며 웹 앱은 보통 지속적으로 배포한다는 내용입니다. 이런 경우라면 훨씬 단순한 워크플로를 쓰라고 권하면서 GitHub flow 를 예로 듭니다. 한편 명시적으로 버전을 매겨 배포하는 소프트웨어를 만들거나 여러 버전을 현장에서 동시에 지원해야 한다면 Git Flow 가 여전히 맞을 수 있다고 적었습니다. 글은 "panaceas don't exist"(만병통치약은 없다)와 "Decide for yourself"(스스로 판단하라)로 끝납니다.

그러니 "Git Flow 는 틀렸다"가 아니라 **"Git Flow 는 어떤 소프트웨어를 전제로 한 모델인가"**를 물어야 합니다.

## 브랜치는 다섯 종류입니다

원문은 오래 사는 브랜치 둘과 잠깐 쓰고 지우는 브랜치 셋으로 나눕니다. 원문은 기본 브랜치를 `master` 로 쓰는데 이 글에서는 요즘 이름인 `main` 으로 적습니다.

- **main**: 늘 production-ready 상태를 가리킵니다. 여기에 들어오는 커밋은 곧 릴리스입니다.
- **develop**: 다음 릴리스에 들어갈 최신 변경이 모이는 곳입니다.
- **feature**: develop 에서 따서 develop 으로 돌아옵니다. 기능 하나를 만드는 동안만 삽니다.
- **release**: develop 에서 따서 develop 과 main 으로 돌아옵니다. 출시 준비용 브랜치입니다. 원문 이름 규칙은 `release-*` 입니다.
- **hotfix**: main 에서 따서 main 과 develop 으로 돌아옵니다. 운영 중인 버전의 긴급 수정용이고 규칙은 `hotfix-*` 입니다.

feature 이름은 `master`, `develop`, `release-*`, `hotfix-*` 만 피하면 자유입니다. 이 글에서는 `feature/login`, `release/1.0`, `hotfix/1.0.1` 처럼 슬래시로 구분해서 적습니다.

## 한 사이클을 명령어로 따라가기

main 만 있는 저장소에서 시작합니다. develop 은 한 번만 만들면 됩니다.

```bash
git switch -c develop main
git push -u origin develop
```

`git switch -c <새 브랜치> [<시작점>]` 은 브랜치를 만들고 바로 이동하는 명령입니다. 원문의 `git checkout -b myfeature develop` 과 같은 일을 합니다.

기능 개발은 develop 에서 feature 브랜치를 따는 데서 시작합니다. 끝나면 `--no-ff` 로 합칩니다.

```bash
git switch -c feature/login develop
# 커밋을 쌓는다
git switch develop
git merge --no-ff feature/login
git branch -d feature/login
git push origin develop
```

`--no-ff` 를 붙이는 이유는 이렇습니다. fast-forward 로 합치면 기능 브랜치가 있었다는 흔적이 사라지고, 어떤 커밋들이 한 기능이었는지 history 에서 알아보기 어려워집니다. 이 옵션이 만드는 merge 커밋의 성격은 [merge 냐 rebase 냐](/posts/git-merge-vs-rebase/)에서 정리해 두었습니다.

릴리스할 기능이 develop 에 모이면 release 브랜치를 땁니다. 이 시점부터 develop 은 다음 버전의 기능을 받기 시작하고, release 브랜치에서는 새 기능 대신 버전 번호 수정과 막판 버그 수정만 합니다.

```bash
git switch -c release/1.0 develop
# 버전 번호 수정, 버그 수정 커밋
git switch main
git merge --no-ff release/1.0
git tag -a v1.0 -m "Release 1.0"
git switch develop
git merge --no-ff release/1.0
git branch -d release/1.0
```

release 에서 한 수정이 develop 에도 들어가야 다음 릴리스에서 같은 버그가 되살아나지 않으므로 마지막에 develop 에도 합칩니다.

출시한 뒤에 운영에서 버그가 나오면 main 에서 바로 hotfix 를 땁니다. develop 에는 아직 출시하지 않은 기능이 섞여 있어서 거기서 따면 안 됩니다.

```bash
git switch -c hotfix/1.0.1 main
# 수정 커밋
git switch main
git merge --no-ff hotfix/1.0.1
git tag -a v1.0.1 -m "Hotfix 1.0.1"
git switch develop
git merge --no-ff hotfix/1.0.1
git branch -d hotfix/1.0.1
```

원문에는 예외가 하나 있습니다. 그 시점에 release 브랜치가 살아 있다면 develop 이 아니라 release 브랜치에 합칩니다. release 가 끝나면 어차피 develop 으로 들어가기 때문입니다.

![main 에서 develop 을 갈라내고 feature/login 을 develop 에 --no-ff 로 합친 뒤, release/1.0 을 따서 마무리 커밋을 하고 main 에 합치며 v1.0 태그를 붙이고 develop 에도 합치는 과정, 이어서 main 에서 hotfix/1.0.1 을 따서 main 에 v1.0.1 태그와 함께 합치고 develop 에도 합치는 과정을 단계별로 보여 주는 애니메이션](@/assets/images/gitflow-timeline.gif)

이 흐름에서 눈여겨볼 곳은 main 입니다. main 의 커밋은 전부 merge 커밋이고 태그가 붙어 있어서 `git log --first-parent main` 한 줄이면 릴리스 목록이 됩니다. 어느 버전에 어떤 수정이 들어갔는지 추적할 때 이 구조가 도움이 됩니다.

## git-flow 도구를 쓸 것인가

위 명령을 매번 손으로 치는 대신 `git flow` 확장을 쓰는 팀도 많습니다. `git flow init` 으로 브랜치 이름 규칙을 정해 두면 `git flow feature start`, `git flow feature finish` 가 따고 합치고 지우는 과정을 한 번에 해 줍니다.

대중적이었던 구현은 git-flow AVH Edition 입니다. 이 저장소는 2023년 6월 19일에 소유자가 아카이브해서 지금은 읽기 전용입니다. 대안으로는 Tower 팀이 Go 로 다시 만든 git-flow-next 가 있습니다. README 는 기존 git-flow 와 git-flow-avh 와의 호환을 내세우고, 브랜치 이름과 merge 전략을 설정할 수 있다고 소개합니다.

손으로 하든 도구를 쓰든 결과 그래프는 같습니다. 저는 처음 배울 때는 손으로 한 번씩 쳐 보는 쪽을 권합니다. 도구가 무슨 일을 하는지 알아야 중간에 멈췄을 때 수습이 되기 때문입니다.

## 이 모델이 잘 맞는 곳

원문이 말하는 조건을 그대로 가져오면 두 가지입니다. 버전이 명시된 소프트웨어, 그리고 여러 버전을 동시에 지원해야 하는 경우입니다. 모바일 앱이 여기에 꽤 들어맞는다고 생각합니다.

웹 서비스는 서버 하나만 새로 배포하면 모든 사용자가 새 버전을 씁니다. 앱은 그렇지 않습니다. 스토어에 올리면 심사를 거치고, 승인이 나도 사용자가 업데이트하기 전까지는 옛 버전이 기기에 남습니다. 운영 중인 버전이 하나가 아니라서 "지금 main 에서 따서 고친다"는 hotfix 개념이 현실과 맞아떨어집니다. release 브랜치도 마찬가지입니다. 심사를 기다리는 동안 develop 은 다음 기능을 계속 받아야 하니까요.

반대로 무겁게 느껴지는 지점도 분명합니다. 하루에도 여러 번 배포하는 서비스에서는 release 브랜치가 거의 매번 몇 시간짜리로 생겼다 사라집니다. 브랜치 두 개에 계속 합쳐야 해서 develop 과 main 이 어긋날 위험도 따라옵니다. 기능 브랜치가 며칠씩 길어지면 develop 에 합칠 때 충돌이 한꺼번에 터집니다. 이런 곳에서는 의식처럼 지키는 절차가 비용만 됩니다.

## GitHub Flow, GitLab Flow, trunk-based 와 나란히 놓으면

**GitHub Flow** 는 가장 가벼운 쪽입니다. GitHub 문서는 스스로를 "lightweight, branch-based workflow" 라고 소개합니다. 기본 브랜치에서 짧은 이름으로 브랜치를 만들고, 커밋을 push 하고, PR 을 열어 리뷰를 받은 뒤 머지하고, 브랜치를 지웁니다. develop 도 release 도 hotfix 도 없습니다. Driessen 이 지속적 배포 환경에서 권한 것이 이쪽입니다.

**GitLab Flow** 는 그 사이를 메웁니다. GitLab 문서에 따르면 main 이 배포할 준비가 되었을 때 production 브랜치에 머지해서 릴리스할 수 있고, 그 사이에 필요한 만큼 pre-production 브랜치를 둘 수 있습니다. 예로 드는 구성이 main, test, acceptance, production 순서입니다. 변경은 main 에서 시작해 아래 환경으로 흘러가고("Commits flow downstream"), 공개 API 처럼 버전을 유지해야 하면 `v1`, `v2` 같은 릴리스 브랜치를 따로 관리합니다. 환경 단계가 있는 조직에서는 Git Flow 의 develop 대신 환경 브랜치가 그 자리를 채우는 모양입니다.

**Trunk-based development** 는 반대쪽 끝입니다. trunkbaseddevelopment.com 의 정의는 개발자들이 trunk 라는 단일 브랜치에서 협업하는 모델입니다. 지속적 통합을 하려면 팀원 모두가 적어도 24시간에 한 번은 trunk 에 커밋해야 한다고 적혀 있습니다. 브랜치를 쓰더라도 개발자 한 명이 짧게 끝내는 규모이고, 매우 작은 팀은 trunk 에 바로 push 하기도 합니다. 아직 끝나지 않은 기능은 feature flag 로 숨겨서 배포합니다. release 브랜치는 선택이라 필요할 때만 trunk 에서 따서 안정화하고 지울 수 있고, 아니면 trunk 에서 바로 릴리스하면서 버그는 앞으로 고쳐 나갑니다(fix forward).

![Git Flow, GitHub Flow, GitLab Flow, trunk-based development 를 장수 브랜치, 릴리스 방식, 핫픽스 경로, 잘 맞는 곳의 네 기준으로 비교한 표](@/assets/images/gitflow-matrix.png)

표를 보면 브랜치 개수보다 **배포 가능한 상태를 어디서 보장하느냐**로 갈립니다. Git Flow 는 main 과 release 가, trunk-based 는 자동 테스트와 feature flag 가 그 역할을 합니다. 그래서 trunk-based 로 옮기려면 브랜치 규칙만 바꾸는 걸로는 부족하고 CI 가 믿을 만해야 합니다.

짧은 브랜치와 작은 PR 로 가려는 팀이 부딪히는 문제는 하나 더 있습니다. 기능이 PR 하나에 안 들어가면 앞 PR 이 머지되기 전에 뒤 PR 을 쌓아야 합니다. 이 마찰은 [jj 와 Sapling 을 열어 본 글](/posts/git-alternatives-sapling-jujutsu/)에서 다뤘습니다.

## 제가 고르는 기준

릴리스가 사람의 승인이나 심사를 거쳐서 나가고 이전 버전이 오래 남는다면 Git Flow 쪽입니다. 전부 지킬 필요는 없습니다. hotfix 가 거의 없는 팀이면 release 브랜치와 develop 만 두고 hotfix 는 임시로 처리해도 됩니다. 원문도 규칙을 교리처럼 받들라고 하지 않았습니다.

반대로 main 에 머지하는 순간 배포된다면 GitHub Flow 로 충분하고, 여기에 환경 단계가 끼면 GitLab Flow 가 자연스럽습니다. 테스트와 flag 인프라가 갖춰진 팀이라면 trunk-based 가 가장 빠릅니다.

어느 쪽이든 브랜치 모델 자체가 병목이 되는 일은 드뭅니다. 릴리스를 누가 언제 결정하느냐가 보통 더 큰 변수라서, 그 방식에 맞는 전략을 고르고 팀 규모나 제품이 바뀌면 전략도 같이 바꾸면 됩니다.

## 참고 자료

- [A successful Git branching model (Vincent Driessen)](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Docs: GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Trunk Based Development](https://trunkbaseddevelopment.com/)
- [GitLab: What is GitLab Flow?](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/)
- [GitLab Docs: Branching strategies](https://docs.gitlab.com/user/project/repository/branches/strategies/)
- [git-switch Documentation](https://git-scm.com/docs/git-switch)
- [git-flow (AVH Edition) 저장소](https://github.com/petervanderdoes/gitflow-avh)
- [git-flow-next 저장소](https://github.com/gittower/git-flow-next)
