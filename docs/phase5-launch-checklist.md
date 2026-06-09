# Phase 5 Launch Checklist

Phase 5(Instagram 베타 수집/모더레이션) production 출시 전 작업 목록. 이 문서는 코드 머지 직전부터 prod 검증까지의 모든 작업을 추적한다.

상위 문서:
- [Phase 5 Plan](plans/2026-06-02-granite-phase-5.md) — 코드 구현 단위
- [Admin Operations](admin-operations.md) — 출시 후 운영 (Phase 3 + Phase 5 통합 SOP)
- [Deployment](deployment.md) — 배포 명령 reference
- [ROADMAP](ROADMAP.md) — 단계 간 의존

각 섹션의 체크박스는 완료 시 `[x]`로 갱신한다.

---

## 0. 머지 직전 (PR 단위)

- [x] `git push origin phase5-implementation`
- [x] PR 생성 — description에 Tasks 1–21 요약 + Codex 5회 review 이력 + 알려진 limitation
- [x] CI 통과 확인 (tests, typecheck, build, wrangler dry-run; 로컬 Node v20 환경 한정 dry-run 실패는 CI에서 v22로 대체)
- [x] main 변경분 있으면 rebase 또는 merge
- [x] migrations `0004`, `0005`는 roll-forward only — PR description에 명시
- [x] Reviewer 지정 + 승인 1건 이상

---

## 1. Instagram / Meta 사전 작업 ★ 가장 큰 일정 리스크

### 1-A. Instagram 계정 준비

- [x] **Instagram Business 또는 Creator 계정** 전환 (모바일 앱 → 설정 → 계정 → 프로페셔널 계정)
- [x] **Facebook Page와 연결** (Graph API의 모든 Instagram 엔드포인트는 connected Page 필수)
- [x] **권한 있는 admin 계정 지정** (App Review 제출자, 토큰 발급자)
- [x] 계정명/핸들 결정 — 예: `@granite.kr` (사용자에게 멘션 양식을 안내해야 하므로 출시 후 변경 불가 전제)

### 1-B. Meta for Developers 앱 등록

- [x] developers.facebook.com → 새 앱 생성 (App Type: **Business** 권장)
- [x] Instagram product 추가 ("Instagram API with Instagram Login" 또는 "Instagram Graph API")
- [x] App ID / App Secret 발급 후 안전 보관 (`META_APP_ID`, `META_APP_SECRET`)
- [x] **Privacy Policy URL 등록** — 한글 개인정보처리방침 페이지 필수. **Granite 도메인에 미존재 → 신규 생성 필요**
- [x] **Terms of Service URL 등록**
- [x] **Data Deletion URL 등록** — 사용자가 데이터 삭제 요청할 수 있는 페이지 (Granite 미존재 → 신규)
- [x] App Icon 1024×1024 업로드 (브랜드 로고)
- [x] Business Verification 절차 (해외 지역은 사업자 등록증 등 서류 요청 가능)

### 1-C. Graph API 권한 신청 (App Review)

요청해야 할 permission:

| Permission | 사용처 | 필수 여부 |
|------------|--------|----------|
| `instagram_basic` | 기본 계정 정보 | ✅ 필수 |
| `instagram_manage_comments` | 멘션/댓글 이벤트 수신 — webhook 핵심 | ✅ 필수 |
| `pages_show_list` | 연결된 Page 조회 | ✅ 필수 |
| `pages_read_engagement` | Page 메타데이터 | ✅ 필수 |
| `pages_manage_metadata` | webhook 구독 관리 | ✅ 필수 |
| `instagram_content_publish` | Phase 5 미사용 | ❌ |
| `instagram_manage_insights` | Phase 5 미사용 | ❌ |

App Review 제출 자료:

- [ ] **Use case 영상** — 사용자가 `@granite.kr` 멘션 → Granite 앱에서 Beta 표시되는 흐름 screencast
- [ ] **테스트 계정** — Meta 검수자가 직접 테스트할 IG 계정 정보
- [ ] **상세 use case 텍스트** — "Granite은 클라이밍 베타 영상 큐레이션 플랫폼으로, 사용자가 자신의 IG 영상에 `@granite.kr`을 멘션하면 해당 영상이 루트별 베타 컬렉션에 표시됩니다"
- [ ] 검수 제출
- [ ] 검수 통과 (보통 1–2주, 거절 시 재제출)

⚠️ **이 단계가 Phase 5 출시 최대 일정 리스크**. 1차 제출 거절 가정하고 일정 짤 것.

### 1-D. Webhook 구독 등록

- [ ] App Dashboard → Webhooks → Instagram product
- [ ] Callback URL 등록: `https://<worker-domain>/webhooks/instagram`
- [ ] Verify Token: Worker secret `META_WEBHOOK_VERIFY_TOKEN`과 정확히 같은 값
- [ ] Field 구독: `mentions` (caption 멘션). 필요시 `comments` 추가
- [ ] Meta가 보내는 `GET /webhooks/instagram?hub.mode=subscribe&...` challenge 통과 확인

### 1-E. Access Token 발급

권장 방식: **System User token** (만료 없음)

- [ ] Meta Business Manager 등록 (없으면)
- [ ] Business Manager에 System User 생성
- [ ] System User에 Granite Instagram Page admin 권한 부여
- [ ] System User token 발급 → `META_PAGE_ACCESS_TOKEN`으로 Worker secret 설정
- [ ] 토큰 발급 일자 + 발급자 기록

대안 (System User 사용 불가 시): Long-lived Page token (60일 만료)

- [ ] Graph API Explorer에서 short-lived user token 발급
- [ ] long-lived user token으로 exchange (60일)
- [ ] `/me/accounts` 호출 → Granite Page의 long-lived Page token 추출
- [ ] `META_PAGE_ACCESS_TOKEN`으로 설정

### 1-F. 토큰 만료 SOP

System User 사용 시 일반적으로 무관하지만 보안 회전 차원에서:

- [ ] **토큰 갱신 책임자 결정 및 문서 기록** (`docs/admin-operations.md` Graph API 토큰 라이프사이클 섹션)
- [ ] 캘린더 리마인더: 만료 50일째 (long-lived Page token 사용 시)
- [ ] 갱신 후 검증 절차: test mention 1건이 정상 처리되는지 `/admin/webhooks` 모니터링

⚠️ Phase 6에서 admin OAuth UI로 토큰 자동 갱신 기능 추가 예정 (Future Work).

---

## 2. Cloudflare 인프라

### 2-A. D1 Migrations

- [x] production D1에 `0004_beta_instagram.sql` 적용
- [x] production D1에 `0005_webhook_inbox_external_media_id.sql` 적용

```bash
pnpm wrangler d1 migrations apply granite
```

- [x] schema 검증

```bash
pnpm wrangler d1 execute granite --command="PRAGMA table_info(webhook_inbox)"
pnpm wrangler d1 execute granite --command="PRAGMA table_info(betas)"
pnpm wrangler d1 execute granite --command="PRAGMA table_info(webhook_operational_events)"
```

⚠️ **Roll-forward only**. Schema rollback 불가. PITR(D1 자동 백업)으로 복구 가능하지만 마지막 commit 시점까지.

### 2-B. Worker Secrets

- [x] `META_APP_SECRET` 설정

```bash
pnpm wrangler secret put META_APP_SECRET
```

- [x] `META_WEBHOOK_VERIFY_TOKEN` 설정 (Meta App Dashboard에 입력한 값과 정확히 일치)

```bash
pnpm wrangler secret put META_WEBHOOK_VERIFY_TOKEN
```

- [x] `META_PAGE_ACCESS_TOKEN` 설정

```bash
pnpm wrangler secret put META_PAGE_ACCESS_TOKEN
```

### 2-C. Worker 배포

- [x] `wrangler.toml` 바인딩 검증 (`granite_v2` D1, `BUCKET` R2)
- [x] Worker 배포

```bash
pnpm wrangler deploy
```

- [ ] 배포된 Worker URL 확인 후 Meta App Dashboard Callback URL로 등록 (섹션 1-D)
- [ ] Custom domain 사용 시 Cloudflare Dashboard → Workers → Custom Domains 설정 후 Meta에 재등록

### 2-D. R2 Bucket / CDN

기존 Phase 3 자산 재사용. 추가 작업 없음.

- [ ] `betas/{betaId}/thumb-*.{ext}` 경로 캐싱 정책 확인 (이미지 1년 캐시 권장)

---

## 3. Vercel 환경변수

기존 ENV는 그대로 유지. Phase 5 추가 항목만 다음과 같다.

- [x] `META_APP_ID` 추가 (Instagram oEmbed 호출용; `lib/beta/thumbnail-r2.ts`)
- [x] `META_APP_SECRET` 추가 (동일)

Vercel Dashboard → Settings → Environment Variables → Production + Preview 둘 다.

---

## 4. 배포 순서

```
1. Meta App 검수 통과         ← 가장 오래 걸림 (1–2주+)
2. D1 migrations 적용 (prod)
3. Worker secrets 설정 (prod)
4. Worker 배포 (prod)
5. Meta App Dashboard에 Worker URL + Verify Token 등록
6. Vercel ENV 추가 (META_APP_ID, META_APP_SECRET)
7. PR 머지
8. Vercel preview → production 승격
9. 출시 게이트 검증 (5절)
```

각 단계 사이에 5-30분 대기 권장 (DNS / CDN propagation).

---

## 5. 출시 게이트 검증 (production-only)

### 5-A. Worker 기본 동작

- [ ] `GET /webhooks/instagram?hub.mode=subscribe&hub.verify_token=<correct>&hub.challenge=abc` → `200 OK` body `abc`
- [ ] `GET ...?hub.verify_token=<wrong>` → `403`
- [ ] `POST /webhooks/instagram` invalid HMAC → `401` + `webhook_operational_events`에 `invalid_signature` 행 기록
- [ ] `POST` valid HMAC → `200 OK` (2초 이내)

### 5-B. End-to-end 시나리오 (= Phase 5 Plan Task 11 Step 5)

- [ ] Test 계정에서 `[모락산] 계원예대 / 큰바위 / Sky Hook (V5)` + `@granite.kr #큰바위 #SkyHook #모락산` 캡션으로 reel 게시
- [ ] `wrangler tail` 로그에서 Worker 처리 확인
- [ ] D1에서 `webhook_inbox.status = 'matched'`, `betas` 행 1건 확인
- [ ] `/admin/webhooks` UI에서 매칭된 행 확인
- [ ] `/admin/betas`에서 `pending` 상태로 노출 → approve → 공개 라우트 베타 그리드에 표시

### 5-C. 동명 케이스

- [ ] 동일 Boulder/Route name을 가진 두 Route를 admin에서 발행
- [ ] 같은 캡션 멘션 → `webhook_inbox.status='unmatched'` + `last_error_code='route_match_ambiguous'`
- [ ] `/admin/webhooks` 수동 매칭 dropdown에 **published route만** 표시되는지 확인 (Task 21)

### 5-D. 썸네일 실패 회복

- [ ] Instagram CDN 응답이 404인 케이스 (만료 URL) → Beta는 생성, `webhook_inbox.last_error_code='thumbnail_copy_failed'`
- [ ] Manual submission에서 R2 자격증명 일시 오류 → Beta는 생성, `betas.thumbnail_url = NULL`

### 5-E. 보안 검증

- [ ] SSRF: `https://example.com/video` manual submission → 거부
- [ ] Forged routeId (draft route ID로 hidden field 변조) → "유효하지 않은 루트입니다." 응답
- [ ] Manual match dropdown에 draft/deleted route가 안 보이는지 확인

### 5-F. 동시성 검증 (Task 20)

- [ ] Meta App Dashboard에서 같은 이벤트를 5분 이내 즉시 redeliver → Worker가 in-flight 행을 reclaim하지 않고 첫 처리가 완료되는지 확인 (`processing_attempts`가 1로 유지)
- [ ] 5분 이상 stale 행에 대해 redeliver → reclaim + 재처리 확인

### 5-G. 운영 SOP / 정책

- [ ] `docs/admin-operations.md` Phase 5 섹션 운영자 검토 완료 (서명자 기록)
- [ ] Raw payload 보관 기간 정책 확정 + 문서 반영
- [ ] Graph API token 만료일 + 갱신 책임자 확정 + 문서 반영

---

## 6. 출시 후 모니터링 (첫 1주)

### 6-A. 일간 점검

- [ ] `wrangler tail` 로그 spot-check (오류 패턴)
- [ ] `/admin/webhooks` 운영 이벤트 패널 카운트 확인
- [ ] `/admin/webhooks` `processing`이 5분 이상 stuck 행이 없는지

### 6-B. 운영 이벤트 임계치 (튜닝 가능)

| 이벤트 | 일간 임계치 | 초과 시 대응 |
|--------|-----------|-------------|
| `invalid_signature` | 5건 | spoofing 시도 추정 or secret mismatch 점검 |
| `graph_api_failure` | 3건 | token 만료 또는 Meta 장애 가능. 토큰 점검 |
| `caption_parse_failed` | 10건 | 사용자에게 캡션 양식 안내 문구 개선 검토 |
| `route_match_ambiguous` | 3건 | 동명 Route 정책 재검토 |
| `duplicate_beta` | 10건 | normal, 모니터링만 |
| `thumbnail_copy_failed` | 5건 | R2 자격증명/네트워크 점검 |

### 6-C. 고립 행 모니터링

- [ ] `/admin/webhooks` "고립된 매칭" (Task 15) 카운트 = 0 유지
- [ ] `/admin/webhooks` "자동 매칭 고립 Beta" (Task 18) 카운트 = 0 유지

발생 시 SOP는 [admin-operations.md](admin-operations.md) Phase 5 섹션 참조.

---

## 알려진 제약 (Phase 5 출시 시점)

| 제약 | 설명 | 향후 처리 |
|------|------|----------|
| **Cross-flow canonical media id 미정렬** | Webhook 자동 매칭은 Instagram 숫자 `media_id` 저장, 수동 등록은 alphanumeric shortcode 저장. 같은 미디어를 두 경로로 등록하면 cross-flow dedup 실패 | Phase 6 |
| **Scheduled retry 없음** | `failed` webhook 행에 대한 자동 재처리 워커 없음. 운영자가 Meta dashboard에서 수동 redeliver | Phase 6 또는 별도 ops task |
| **Manual submission rate limit 없음** | 같은 IP 또는 핸들의 다발성 등록 차단 안 됨. UNIQUE 인덱스로 같은 미디어 중복만 차단 | Phase 6 |
| **Webhook 알림 채널 없음** | 운영 이벤트 발생 시 별도 알림 X. `/admin/webhooks`를 polling | Phase 6 (Future Work) |
| **Graph API token 자동 갱신 UI 없음** | 운영자가 wrangler secret으로 수동 갱신. System User token 사용 시 무관 | Phase 6 OAuth 인프라와 함께 |
| **`orphan_beta` operational event_type 부재** | Task 15/18은 `duplicate_beta` event_type을 재사용하고 `metadata.kind`로 구분 | 별도 migration 시 분리 가능 |

---

## 참고

- [Phase 5 Plan](plans/2026-06-02-granite-phase-5.md)
- [Admin Operations (Phase 3 + Phase 5)](admin-operations.md)
- [Deployment](deployment.md)
- [ROADMAP](ROADMAP.md)
