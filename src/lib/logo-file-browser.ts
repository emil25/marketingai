import { LOGO_MIME_TYPES, MAX_LOGO_SIZE, validateLogoBytes } from "./onboarding-details";

function imageOperation<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("A kép előkészítése túl sokáig tartott. Próbálj kisebb képet.")),
      12000,
    );
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

// Only runs after a local file is chosen; no image leaves the browser here.
export async function prepareLogoFile(file: File): Promise<File> {
  if (!LOGO_MIME_TYPES.includes(file.type.toLowerCase()))
    throw new Error("PNG, JPEG vagy WebP logót válassz.");
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Legfeljebb 20 MB-os képet válassz; mentés előtt kicsinyítjük.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await imageOperation(image.decode());
    } catch {
      throw new Error("A kép nem olvasható. Válassz másik PNG, JPEG vagy WebP fájlt.");
    }
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error("Túl nagy felbontású kép. Válassz legfeljebb 40 megapixeles logót.");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size <= MAX_LOGO_SIZE) {
      validateLogoBytes(new Uint8Array(await file.arrayBuffer()), file.type);
      return file;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A kép kicsinyítése nem támogatott ebben a böngészőben.");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale * 0.75 ** attempt));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale * 0.75 ** attempt));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await imageOperation(
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.88)),
      );
      if (blob && blob.size <= MAX_LOGO_SIZE) {
        validateLogoBytes(new Uint8Array(await blob.arrayBuffer()), blob.type);
        return new File(
          [blob],
          file.name.replace(/\.[^.]+$/, "") +
            (blob.type === "image/png" ? ".png" : blob.type === "image/webp" ? ".webp" : ".jpg"),
          { type: blob.type },
        );
      }
    }
    throw new Error("A kép nem kicsinyíthető 2 MB alá. Válassz egyszerűbb logót.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
