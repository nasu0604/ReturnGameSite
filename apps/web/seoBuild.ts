import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { escapeHtml, renderMetadata } from "./src/seo";
import {
  aboutMetadata,
  aboutParagraphs,
  CLUB_NAME,
  homeMetadata,
  SITE_IMAGE,
  SITE_NAME,
  SITE_URL
} from "./src/siteContent";

export function seoPages(verification: Record<string, string>): Plugin {
  return {
    name: "return-game-seo-pages",
    apply: "build",
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset" || typeof index.source !== "string") {
          this.error("Vite did not produce index.html");
        }
        const template = index.source;
        const verificationTags = [
          ["google-site-verification", verification.GOOGLE_SITE_VERIFICATION],
          ["naver-site-verification", verification.NAVER_SITE_VERIFICATION]
        ].filter(([, token]) => token?.trim())
          .map(([name, token]) => `<meta name="${name}" content="${escapeHtml(token.trim())}">`)
          .join("\n    ");

        const structuredData = JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: SITE_NAME,
              alternateName: ["return Game", "returngame.site"],
              url: `${SITE_URL}/`
            },
            {
              "@type": "Organization",
              name: SITE_NAME,
              alternateName: CLUB_NAME,
              url: `${SITE_URL}/`,
              logo: SITE_IMAGE,
              sameAs: ["https://www.instagram.com/kh.returngame", "https://github.com/KH-ReturnGame"]
            }
          ]
        }).replace(/</g, "\\u003c");

        function page(metadata: Parameters<typeof renderMetadata>[0], body = "", extraHead = "") {
          return template
            .replace(/<title>[^<]*<\/title>/, () => `${renderMetadata(metadata)}${extraHead}`)
            .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
        }

        index.source = page(
          homeMetadata,
          `<main><h1>${escapeHtml(SITE_NAME)}</h1><p>${escapeHtml(CLUB_NAME)}</p><p>${escapeHtml(homeMetadata.description)}</p><a href="/about">동아리 소개와 연혁</a></main>`,
          `\n    ${verificationTags}\n    <script type="application/ld+json">${structuredData}</script>`
        );
        this.emitFile({
          type: "asset",
          fileName: "about.html",
          source: page(
            aboutMetadata,
            `<main><h1>${escapeHtml(SITE_NAME)}</h1><p>${escapeHtml(CLUB_NAME)}</p>${aboutParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<a href="/">메인으로</a></main>`
          )
        });
        this.emitFile({
          type: "asset",
          fileName: "game-shell.html",
          source: page({ title: `게임 | ${SITE_NAME}` })
        });
        this.emitFile({
          type: "asset",
          fileName: "admin-shell.html",
          source: page({ title: `관리자 | ${SITE_NAME}`, noindex: true })
        });
        this.emitFile({
          type: "asset",
          fileName: "404.html",
          source: `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${renderMetadata({ title: `페이지를 찾을 수 없습니다 | ${SITE_NAME}`, noindex: true })}</head><body><main><h1>페이지를 찾을 수 없습니다.</h1><a href="/">메인으로</a></main></body></html>`
        });
        this.emitFile({
          type: "asset",
          fileName: "og-image.png",
          source: await readFile(new URL("./src/assets/logo_long.png", import.meta.url))
        });
      }
    }
  };
}
