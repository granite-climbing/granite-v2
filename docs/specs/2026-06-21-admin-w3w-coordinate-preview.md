# Admin w3w Coordinate Preview Spec

> 작성일: 2026-06-21
> 상태: Draft
> 범위: Phase 4 Admin UX Refinement

## 1. 배경

Granite의 Crag, Sector, Boulder 어드민 폼은 위도와 경도를 직접 입력한다. 자연 볼더링 스팟 운영에서는 현장에서 공유받은 what3words 주소를 기준으로 위치를 기록하는 경우가 있으므로, 운영자가 `///word.word.word` 형식의 w3w 좌표를 입력하면 위도와 경도로 변환되어 기존 `lat`, `lng` 필드에 자동 반영되는 UX가 필요하다.

또한 좌표 오입력은 공개 지도 품질에 직접 영향을 준다. 위도/경도 입력값이 있으면 어드민 폼 안에서 Kakao Map 마커 프리뷰를 표시해 저장 전 위치를 확인할 수 있어야 한다.

## 2. 목표

- Crag, Sector, Boulder 생성/수정 폼의 Location 섹션에서 w3w 주소를 위도/경도로 변환한다.
- 변환 성공 시 기존 `lat`, `lng` input 값을 자동으로 채운다.
- `lat`, `lng`가 모두 유효한 숫자이면 Kakao Map 프리뷰에 단일 마커를 표시한다.
- w3w API key는 브라우저에 노출하지 않고 서버 환경 변수로만 사용한다.
- 기존 저장 Server Action, DB schema, public read path는 변경하지 않는다.

## 3. 비목표

- DB에 w3w 주소를 저장하지 않는다.
- 위도/경도에서 w3w 주소로 역변환하지 않는다.
- 자동완성, 유사 w3w 후보 추천, 음성 입력은 구현하지 않는다.
- Kakao Map에서 마커 드래그로 좌표를 수정하는 기능은 이번 범위에 포함하지 않는다.

## 4. 대상 화면

- `/admin/content/crags`
  - Create Crag Location 섹션
  - Edit Crag Location 섹션
- `/admin/content/sectors`
  - Create Sector Location 섹션
  - Edit Sector Location 섹션
- `/admin/content/boulders`
  - Create Boulder Location 섹션
  - Edit Boulder Location 섹션

Crag/Sector 좌표는 optional이다. Boulder 좌표는 기존 정책대로 required이다.

## 5. 환경 변수

새 서버 환경 변수:

| 키 | 용도 |
|----|------|
| `W3W_API_KEY` | what3words `convert-to-coordinates` API 호출용 서버 전용 키 |

`W3W_API_KEY`가 없으면 변환 버튼은 실패 메시지를 표시한다. 이 상태에서도 운영자는 기존처럼 위도/경도를 직접 입력하고 저장할 수 있다.

## 6. 외부 API

what3words 공식 API v3의 `convert-to-coordinates` 엔드포인트를 사용한다.

- Method: `GET`
- URL: `https://api.what3words.com/v3/convert-to-coordinates`
- Query:
  - `words`: 입력된 3 word address
  - `format=json`
- Header:
  - `X-Api-Key: <W3W_API_KEY>`

공식 문서 기준 응답의 `coordinates.lat`, `coordinates.lng`는 WGS84 좌표다. Granite DB의 `lat`, `lng`도 WGS84 `REAL`이므로 좌표계 변환은 필요 없다.

참고: https://developer.what3words.com/public-api/docs

## 7. UX

Location 섹션은 하나의 재사용 컴포넌트로 렌더링한다.

필드 구성:

- `what3words` 텍스트 입력
  - placeholder: `///filled.count.soap`
  - 폼 submit 대상이 아니므로 `name`을 부여하지 않는다.
  - 이 입력은 저장 `<form>` 내부에 있으므로, Enter 키 입력 시 부모 저장 폼이 제출되는 것을 막고 대신 변환을 실행한다 (`onKeyDown`에서 `preventDefault` 후 Convert 호출).
- `Convert` 버튼
  - 클릭 시 서버 액션을 호출한다.
  - 진행 중 비활성화하고 `Converting...` 상태를 표시한다.
- `lat`, `lng` number input
  - 기존 `name="lat"`, `name="lng"` 유지
  - required 여부는 호출하는 페이지가 지정한다.
- Kakao Map preview
  - 유효한 좌표 두 개가 있으면 표시한다.
  - 좌표가 비어 있거나 숫자가 아니면 회색 안내 박스를 표시한다.
  - Map 높이는 고정값 `220px`로 둬 입력 중 레이아웃 흔들림을 막는다.

에러 메시지:

- 빈 w3w 입력: `Enter a what3words address.`
- API key 누락: `what3words API key is not configured.`
- 유효하지 않은 w3w 주소: `Invalid what3words address.`
- 네트워크/API 실패: `Could not convert this what3words address.`

## 8. 아키텍처

### 8.1 서버 경계

`lib/actions/admin-location.ts`에 admin 전용 Server Action을 추가한다.

- `convertW3wToCoordinatesAction(input: unknown)`
  - `requireAdmin()`으로 관리자 인증을 확인한다.
  - Zod로 입력을 검증한다.
  - `lib/location/what3words.ts`의 순수 변환 클라이언트를 호출한다.
  - 성공 시 `{ ok: true, lat, lng }`를 반환한다.
  - 실패 시 throw하지 않고 `{ ok: false, message }`를 반환해 클라이언트 폼이 안정적으로 메시지를 표시하게 한다.

### 8.2 API 클라이언트

`lib/location/what3words.ts`는 what3words API 호출과 응답 검증만 담당한다.

- `normalizeW3wAddress(value: string): string`
  - 앞뒤 공백 제거
  - 선행 `///` 제거
  - 내부 공백 제거는 하지 않는다.
- `convertW3wToCoordinates(words: string, options?: { apiKey?: string; fetchImpl?: typeof fetch })`
  - 테스트에서 `fetchImpl`을 주입할 수 있게 한다.
  - API key는 옵션 우선, 없으면 `process.env.W3W_API_KEY`.
  - HTTP 에러와 잘못된 JSON shape을 명확한 에러로 변환한다.

### 8.3 클라이언트 컴포넌트

`components/admin/location-coordinate-field.tsx`를 만든다.

역할:

- w3w 입력 상태 관리
- 변환 Server Action 호출
- 변환 성공 시 `lat`, `lng` 상태 업데이트
- 직접 입력된 `lat`, `lng` 변화 감지
- Kakao Map 마커 프리뷰 표시

기존 `components/public/kakao-map.tsx`는 public 명칭이지만 클라이언트 지도 wrapper로 이미 범용적이다. 이번 작업에서는 새 지도 wrapper를 만들지 않고 이 컴포넌트를 재사용한다.

## 9. 보안

- `W3W_API_KEY`는 `NEXT_PUBLIC_` prefix를 쓰지 않는다.
- 브라우저에서 what3words API를 직접 호출하지 않는다.
- 변환 Server Action은 `requireAdmin()`을 호출한다.
- w3w 입력값은 저장하지 않고 좌표 변환에만 사용한다.

## 10. 테스트

단위 테스트:

- `normalizeW3wAddress`가 `///filled.count.soap`을 `filled.count.soap`로 정규화한다.
- API key 누락 시 명확한 에러를 낸다.
- what3words 성공 응답을 `{ lat, lng }`로 반환한다.
- what3words `BadWords` 에러를 `Invalid what3words address.`로 매핑한다.
- Server Action이 관리자 인증 후 성공 결과를 반환한다.
- Server Action이 변환 실패를 `{ ok: false, message }`로 반환한다.

수동 확인:

- Crag create/edit에서 w3w 변환 후 `lat`, `lng`가 채워진다.
- Sector create/edit에서 좌표 직접 입력 시 Kakao Map 마커가 이동한다.
- Boulder create/edit에서 기존 좌표가 있는 경우 drawer 오픈 즉시 프리뷰가 보인다.
- `W3W_API_KEY`가 없는 로컬 환경에서도 직접 좌표 입력 저장은 가능하다.

## 11. 완료 기준

- `pnpm test lib/location/what3words.test.ts lib/actions/admin-location.test.ts` 통과
- `pnpm typecheck` 통과
- 세 어드민 콘텐츠 화면이 새 Location 컴포넌트를 사용한다.
- 기존 `saveCragAction`, `saveSectorAction`, `saveBoulderAction` 동작과 payload shape이 유지된다.
