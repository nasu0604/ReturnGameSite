import type { ClubHistoryRecord } from "@return-game/shared";
import { ArrowLeft } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";

interface HistoryResponse {
  history: ClubHistoryRecord[];
}

const ABOUT_DESCRIPTION = `return Game;은 2024년 만들어진 경희고등학교의 유일한 게임 개발 동아리로, 게임 기획부터 배포까지 전 과정을 ‘게임 개발’이라는 하나의 목표 아래 체계적으로 진행하는 동아리입니다. 자유로운 분위기 속에서 직접 게임을 개발하고, 관련 분야에 대한 학습도 함께 이루어지기 때문에 부원들의 경험과 실력을 한층 더 성장시키는 데 도움이 되고 있습니다.

현재 교내 스타트업 동아리 중 가장 많은 인원이 활동하고 있는 만큼, 동아리의 활동량 또한 매우 활발합니다. 또한 저희는 멘토-멘티 제도와 같은 자체 교육 시스템을 운영하며, 부원들의 수준에 맞춘 개인별 멘토링을 진행하고 있습니다. 더불어 교내 ‘소프트웨어 딥다이브’ 프로그램과 연계하여 다양한 경험을 쌓을 수 있도록 지원하고 있습니다.

이외에도 다양한 활동을 통해 의미 있는 학생부 기록을 쌓아 나갈 수 있도록 돕고 있으며, 우수한 성과로도 이어지고 있습니다. 저희 return Game;은 알찬 동아리 활동을 시작하고 완성할 수 있는 공간이 되어나가겠습니다.`;

function getHistoryYear(item: ClubHistoryRecord) {
  return new Date(item.eventDate).getFullYear().toString();
}

function getHistoryDate(item: ClubHistoryRecord) {
  const date = new Date(item.eventDate);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function groupHistoryByYear(history: ClubHistoryRecord[]) {
  const groups = new Map<string, ClubHistoryRecord[]>();

  for (const item of history) {
    const year = getHistoryYear(item);
    groups.set(year, [...(groups.get(year) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
}

function renderHistoryTextWithNotes(text: string) {
  const parts = text.split(/(\([^()]+\))/g);

  return parts.map((part, index) => {
    if (!part) return null;
    const isNote = part.startsWith("(") && part.endsWith(")");
    return (
      <Fragment key={`${part}-${index}`}>
        {isNote ? <span className="history-muted-note">{part}</span> : part}
      </Fragment>
    );
  });
}

export function AboutPage() {
  const [history, setHistory] = useState<ClubHistoryRecord[]>([]);
  const [status, setStatus] = useState("연혁을 불러오는 중입니다.");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    apiGet<HistoryResponse>("/history")
      .then((payload) => {
        setHistory(payload.history);
        setStatus(payload.history.length === 0 ? "아직 공개된 연혁이 없습니다." : "");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "연혁을 불러오지 못했습니다.");
      });
  }, []);

  const aboutParagraphs = ABOUT_DESCRIPTION.split("\n\n");
  const historyGroups = groupHistoryByYear(history);

  return (
    <section className="about-page">
      <Link className="about-home-link" to="/">
        <ArrowLeft aria-hidden="true" />
        메인으로
      </Link>

      <header className="about-hero">
        <p className="about-kicker">Who We Are</p>
        <h1>return Game;</h1>
        <p className="about-subtitle">경희고등학교 게임 개발 동아리</p>
        <div className="about-description" aria-label="동아리 소개">
          {aboutParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </header>

      <section className="history-section" aria-labelledby="history-title">
        <div className="history-heading">
          <p className="about-kicker">Timeline</p>
          <h2 className="history-title-sub" id="history-title">
            동아리 연혁
          </h2>
        </div>
        {status && <p className="status-text">{status}</p>}
        <div className="history-list-timeline">
          {historyGroups.map((group, index) => {
            const side = index % 2 === 0 ? "right" : "left";
            return (
              <div className={`history-year-group ${side}`} key={group.year}>
                <span className="history-dot" aria-hidden="true" />
                <div className="history-year-block">
                  <span className="history-year" data-year={group.year}>
                    {group.year}
                  </span>
                  <ul className="history-events">
                    {group.items.map((item) => (
                      <li className="history-event" key={item.id}>
                        <time className="history-event-date" dateTime={item.eventDate}>
                          {getHistoryDate(item)}
                        </time>
                        <span className="history-event-text">
                          {renderHistoryTextWithNotes(item.title)}
                          {item.summary && (
                            <span className="history-event-summary">
                              {renderHistoryTextWithNotes(item.summary)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
