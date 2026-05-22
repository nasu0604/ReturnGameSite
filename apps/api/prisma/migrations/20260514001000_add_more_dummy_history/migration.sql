INSERT INTO "ClubHistory" (
  "id",
  "dateLabel",
  "title",
  "summary",
  "description",
  "imageUrl",
  "tags",
  "status",
  "displayOrder",
  "createdAt",
  "updatedAt"
) VALUES
(
  'dummy-history-2024-workshop',
  '2024.07',
  '첫 게임 제작 워크숍',
  'Unity와 WebGL 빌드 흐름을 함께 실습했습니다.',
  '동아리원들이 Unity 프로젝트 구조와 WebGL 빌드 과정을 익히고, 간단한 플레이 가능한 결과물을 만들어보는 워크숍을 진행했습니다.',
  NULL,
  '["워크숍","Unity","기초"]'::jsonb,
  'PUBLISHED',
  15,
  NOW(),
  NOW()
),
(
  'dummy-history-2025-feedback',
  '2025.09',
  '플레이 테스트 운영',
  '전시 게임을 직접 플레이하고 의견을 남기는 시간을 마련했습니다.',
  '축제 전후로 동아리원과 방문자가 게임을 직접 플레이하며 난이도, 조작감, 화면 구성에 대한 피드백을 주고받았습니다.',
  NULL,
  '["플레이테스트","피드백","개선"]'::jsonb,
  'PUBLISHED',
  25,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
