PRAGMA foreign_keys = ON;

INSERT INTO areas (id, name, slug, sort_order) VALUES
  ('area-capital', '수도권', 'capital', 1),
  ('area-gangwon', '강원', 'gangwon', 2),
  ('area-chungcheong', '충청', 'chungcheong', 3),
  ('area-jeolla', '전라', 'jeolla', 4),
  ('area-gyeongsang', '경상', 'gyeongsang', 5);

INSERT INTO crags (
  id, area_id, name, slug, lat, lng, summary, access_desc, parking_desc, season, cover_image_url, is_published
) VALUES
  (
    'crag-moraksan',
    'area-capital',
    '모락산',
    'moraksan',
    37.3722,
    126.9781,
    '의왕 도심과 가까운 화강암 볼더링 Crag. 짧은 접근과 다양한 슬랩/페이스 라인이 장점이다.',
    '계원예대 방면 등산로에서 15분 접근. 비 온 뒤에는 바위가 늦게 마른다.',
    '공영주차장 또는 계원예대 인근 유료 주차장을 이용한다.',
    '가을·겨울·초봄',
    '/images/figma/crag-card.jpg',
    1
  ),
  (
    'crag-anyang',
    'area-capital',
    '안양예술공원',
    'anyang',
    37.3943,
    126.9568,
    '생활권에서 접근하기 쉬운 소규모 자연 볼더링 구역.',
    '관악산 둘레길에서 분기해 접근한다.',
    '공영주차장 이용 권장.',
    '가을·겨울',
    '/images/figma/crag-card.jpg',
    1
  );

INSERT INTO sectors (
  id, crag_id, name, slug, lat, lng, summary, access_desc, parking_desc, season, cover_image_url, is_published
) VALUES
  ('sector-gamja', 'crag-moraksan', '감자', 'gamja', 37.3719, 126.9784, '모락산 대표 볼더가 모인 Sector.', '주 등산로에서 왼쪽 능선으로 진입한다.', '계원예대 인근 주차 후 도보 접근.', '가을·겨울', '/images/figma/crag-card.jpg', 1),
  ('sector-gyewon', 'crag-moraksan', '계원예대', 'gyewon', 37.373, 126.9776, '짧은 접근의 워밍업 라인이 많은 Sector.', '학교 뒤편 산책로에서 접근한다.', '유료 주차장 이용.', '가을·초봄', '/images/figma/crag-card.jpg', 1),
  ('sector-anyang-main', 'crag-anyang', '메인', 'main', 37.394, 126.9564, '안양 Crag의 기본 Sector.', '둘레길 초입에서 10분.', '공영주차장 이용.', '겨울', '/images/figma/crag-card.jpg', 1);

INSERT INTO boulders (
  id, sector_id, name, slug, lat, lng, coord_precision, rock_type, hashtags, cover_image_url, is_published
) VALUES
  ('boulder-big', 'sector-gamja', '큰바위', 'big-rock', 37.37192, 126.97842, 'exact', 'granite', '["모락산","슬랩"]', '/images/figma/crag-card.jpg', 1),
  ('boulder-potato', 'sector-gamja', '감자바위', 'potato', 37.37183, 126.9787, 'exact', 'granite', '["감자","페이스"]', '/images/figma/crag-card.jpg', 1),
  ('boulder-campus', 'sector-gyewon', '캠퍼스', 'campus', 37.37303, 126.97761, 'exact', 'granite', '["계원예대","워밍업"]', '/images/figma/crag-card.jpg', 1),
  ('boulder-creek', 'sector-anyang-main', '계곡바위', 'creek', 37.39409, 126.95639, 'approximate', 'granite', '["안양","크림프"]', '/images/figma/crag-card.jpg', 1);

INSERT INTO topos (id, boulder_id, name, base_image_url, sort_order) VALUES
  ('topo-big-main', 'boulder-big', 'Main Face', '/images/figma/crag-card.jpg', 1),
  ('topo-potato-main', 'boulder-potato', 'South Face', '/images/figma/crag-card.jpg', 1),
  ('topo-campus-main', 'boulder-campus', 'Warmup Face', '/images/figma/crag-card.jpg', 1),
  ('topo-creek-main', 'boulder-creek', 'Creek Face', '/images/figma/crag-card.jpg', 1);

INSERT INTO routes (
  id, topo_id, boulder_id, name, slug, grade, grade_num, fa, description, line_image_url, is_published
) VALUES
  ('route-sky-hook', 'topo-big-main', 'boulder-big', 'Sky Hook', 'sky-hook', 'V5', 5, 'Granite Crew', '높은 오른손 훅에서 균형을 잡는 모락산 대표 라인.', '/images/figma/crag-card.jpg', 1),
  ('route-river-stone', 'topo-big-main', 'boulder-big', 'River Stone', 'river-stone', 'V3', 3, 'Unknown', '슬랩 발을 믿고 올라서는 밸런스 라인.', '/images/figma/crag-card.jpg', 1),
  ('route-potato-chip', 'topo-potato-main', 'boulder-potato', 'Potato Chip', 'potato-chip', 'V2', 2, 'Unknown', '얇은 크림프를 따라가는 짧은 문제.', '/images/figma/crag-card.jpg', 1),
  ('route-gamja-arete', 'topo-potato-main', 'boulder-potato', '감자 아레트', 'gamja-arete', 'V4', 4, 'Granite Crew', '아레트 압박과 힐훅이 핵심.', '/images/figma/crag-card.jpg', 1),
  ('route-campus-one', 'topo-campus-main', 'boulder-campus', 'Campus One', 'campus-one', 'V1', 1, 'Unknown', '워밍업에 좋은 쉬운 라인.', '/images/figma/crag-card.jpg', 1),
  ('route-creek-crimp', 'topo-creek-main', 'boulder-creek', 'Creek Crimp', 'creek-crimp', 'V6', 6, 'Unknown', '작은 홀드를 이어가는 강한 라인.', '/images/figma/crag-card.jpg', 1),
  ('route-creek-slab', 'topo-creek-main', 'boulder-creek', 'Creek Slab', 'creek-slab', 'V0', 0, 'Unknown', '초심자도 시도 가능한 슬랩.', '/images/figma/crag-card.jpg', 1);

INSERT INTO announcements (
  id, title, body, cover_image_url, crag_id, link_url, is_published, published_at, sort_order
) VALUES
  (
    'announcement-moraksan',
    '모락산 감자 Sector 업데이트',
    '큰바위 Topo와 Route 2개를 새로 정리했습니다.',
    '/images/figma/crag-card.jpg',
    'crag-moraksan',
    '/c/moraksan',
    1,
    '2026-05-13',
    1
  );
