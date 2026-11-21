import { SITE_IMAGE, SITE_NAME, SITE_URL } from "./siteContent";

interface PageMetadata {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

export function renderMetadata({ title, description, path, image, noindex }: PageMetadata) {
  const tags = [`<title data-page-meta>${escapeHtml(title)}</title>`];
  if (description) {
    tags.push(`<meta data-page-meta name="description" content="${escapeHtml(description)}">`);
  }
  if (noindex) {
    tags.push('<meta data-page-meta name="robots" content="noindex">');
  }
  if (path) {
    const url = escapeHtml(new URL(path, SITE_URL).href);
    tags.push(
      `<link data-page-meta rel="canonical" href="${url}">`,
      `<meta data-page-meta property="og:url" content="${url}">`,
      '<meta data-page-meta property="og:type" content="website">',
      '<meta data-page-meta property="og:locale" content="ko_KR">',
      `<meta data-page-meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
      `<meta data-page-meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta data-page-meta property="og:image" content="${escapeHtml(image || SITE_IMAGE)}">`,
      '<meta data-page-meta name="twitter:card" content="summary_large_image">'
    );
    if (description) {
      tags.push(`<meta data-page-meta property="og:description" content="${escapeHtml(description)}">`);
    }
  }
  return tags.join("\n    ");
}
