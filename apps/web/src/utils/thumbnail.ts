const THUMBNAIL_WIDTH = 777;
const THUMBNAIL_HEIGHT = 458;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("썸네일 이미지를 불러오지 못했습니다."));
    };
    image.src = url;
  });
}

export async function resizeThumbnail(file: File) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("썸네일 변환을 지원하지 않는 브라우저입니다.");

  const sourceRatio = image.width / image.height;
  const targetRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("썸네일 변환에 실패했습니다.");

  return new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
}
