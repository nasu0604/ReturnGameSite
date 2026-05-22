import { CircleHelp, Info } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface InfoPopoverProps {
  ariaLabel: string;
  className?: string;
  icon?: ReactNode;
  items?: string[];
  label?: string;
  placement?: "upload" | "edit";
  subtitle?: string;
  title: string;
}

const EXIT_ANIMATION_MS = 180;

const webglBuildSteps = [
  "좌측 상단 [File]-[Build Profiles]-[Web]-[Switch Platform]",
  "Build Profiles 창 상단 [Project Settings]-[Player]-[Settings for Web]",
  "[Resolution and Presentation]-Default Canvas 수치를 Width 1008, Height 567으로 변경",
  "[Publishing Settings]-Compression Format을 Disabled로 설정",
  "Build Profiles 창으로 돌아와 [Build] 후 경로 지정",
  "빌드 될 때까지 대기",
  "Build 폴더, TemplateData 폴더, index.html 모두를 압축"
];

const webglUpdateNotes = [
  "Canvas 컴포넌트 창 진입",
  "Canvas Scaler 확인",
  "UI Scale Mode를 'Scale with Screen Size'로 변경",
  "Referenc Resolution을 X 1920, Y 1080으로 변경",
  "Screen Match Mode를 'Match Width Or Height'로 변경",
  'Match를 0.5로 변경',
  'Reference Pixels Per Unit을 100으로 변경'
];

function InfoPopover({
  ariaLabel,
  className,
  icon,
  items,
  label,
  placement = "upload",
  subtitle,
  title
}: InfoPopoverProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const isVisible = isPinned || (isHovered && !suppressHover);
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => {
        setIsAnimatingOpen(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setIsAnimatingOpen(false);

    if (!shouldRender) {
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isVisible, shouldRender]);

  return (
    <span
      className={`webgl-file-label ${isAnimatingOpen ? "is-open" : ""} ${shouldRender && !isVisible ? "is-closing" : ""} ${
        className ?? ""
      }`}
      data-placement={placement}
      onMouseEnter={() => {
        setSuppressHover(false);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setSuppressHover(false);
      }}
    >
      {label && <span>{label}</span>}
      <button
        aria-expanded={isVisible}
        aria-label={ariaLabel}
        className="webgl-info-button"
        onClick={() => {
          setSuppressHover(!isPinned);
          setIsPinned((current) => !current);
        }}
        type="button"
      >
        {icon ?? <Info size={15} />}
      </button>
      {shouldRender && (
        <span className="webgl-info-popover" role="tooltip">
          <strong>{title}</strong>
          {subtitle && <span className="webgl-info-subtitle">{subtitle}</span>}
          {items && items.length > 0 && (
            <ol>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}
        </span>
      )}
    </span>
  );
}

export function WebglZipInfo({
  className,
  label,
  placement = "upload"
}: Pick<InfoPopoverProps, "className" | "label" | "placement">) {
  return (
    <InfoPopover
      ariaLabel= "업로드 안내"
      className={className}
      items={webglBuildSteps}
      label={label}
      placement={placement}
      subtitle="완성된 게임을 아래 방법대로 빌드한 후 업로드 해주세요."
      title="업로드 방법 안내"
    />
  );
}

export function WebglQuestionInfo({
  className,
  label,
  placement = "edit"
}: Pick<InfoPopoverProps, "className" | "label" | "placement">) {
  return (
    <InfoPopover
      ariaLabel="게임의 UI가 깨진다면"
      className={className}
      icon={<CircleHelp size={15} />}
      items={webglUpdateNotes}
      label={label}
      placement={placement}
      subtitle="빌드 과정에서 해상도를 강제로 변경하기 때문에 생기는 문제입니다."
      title="업로드 한 게임의 UI가 깨진다면?"
    />
  );
}

export function ThumbnailImageInfo({
  className,
  label,
  placement = "upload"
}: Pick<InfoPopoverProps, "className" | "label" | "placement">) {
  return (
    <InfoPopover
      ariaLabel="썸네일 이미지 안내"
      className={`thumbnail-info ${className ?? ""}`}
      label={label}
      placement={placement}
      subtitle="권장 해상도: 777x458px"
      title="썸네일 이미지 안내"
    />
  );
}
