import { useEffect } from "react";
import { renderMetadata } from "../seo";

export function usePageMetadata({ title, description, path, image, noindex }: Parameters<typeof renderMetadata>[0]) {
  useEffect(() => {
    const metadata = document.createElement("template");
    metadata.innerHTML = renderMetadata({ title, description, path, image, noindex });
    document.head.querySelectorAll("[data-page-meta], title").forEach((tag) => tag.remove());
    document.head.append(metadata.content);
  }, [title, description, path, image, noindex]);
}
