export const SITE_URL = "https://returngame.site";
export const SITE_NAME = "return Game;";
export const CLUB_NAME = "경희고등학교 게임 개발 동아리";
export const SITE_IMAGE = `${SITE_URL}/og-image.png`;

export const homeMetadata = {
  title: `${CLUB_NAME} | ${SITE_NAME}`,
  description: `경희고등학교 게임 개발 동아리 return Game; 입니다. 게임 기획부터 배포까지 전반적인 과정을 체계적으로 진행하고 있습니다.`,
  path: "/"
};

export const aboutMetadata = {
  title: `동아리 소개와 연혁 | ${SITE_NAME}`,
  description: "경희고등학교 게임 개발 동아리 return Game; 입니다. 게임 기획부터 배포까지 전반적인 과정을 체계적으로 진행하고 있습니다.",
  path: "/about",
  noindex: "googlebot" as const
};

export const aboutParagraphs = [
  "return Game;은 2024년 만들어진 경희고등학교의 유일한 게임 개발 동아리로, 게임 기획부터 배포까지 전 과정을 ‘게임 개발’이라는 하나의 목표 아래 체계적으로 진행하는 동아리입니다. 자유로운 분위기 속에서 직접 게임을 개발하고, 관련 분야에 대한 학습도 함께 이루어지기 때문에 부원들의 경험과 실력을 한층 더 성장시키는 데 도움이 되고 있습니다.",
  "현재 교내 스타트업 동아리 중 가장 많은 인원이 활동하고 있는 만큼, 동아리의 활동량 또한 매우 활발합니다. 또한 저희는 멘토-멘티 제도와 같은 자체 교육 시스템을 운영하며, 부원들의 수준에 맞춘 개인별 멘토링을 진행하고 있습니다. 더불어 교내 ‘소프트웨어 딥다이브’ 프로그램과 연계하여 다양한 경험을 쌓을 수 있도록 지원하고 있습니다.",
  "이외에도 다양한 활동을 통해 의미 있는 학생부 기록을 쌓아 나갈 수 있도록 돕고 있으며, 우수한 성과로도 이어지고 있습니다. 저희 return Game;은 알찬 동아리 활동을 시작하고 완성할 수 있는 공간이 되어나가겠습니다."
];
