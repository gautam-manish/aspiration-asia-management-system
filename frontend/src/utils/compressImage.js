// Client-side image compressor.
//
// Reads a JPG/JPEG file, scales it down so the longer side is at most
// `maxDim` pixels, then re-encodes as JPEG at the given quality. Typical
// 4 MB phone photo → 150–250 KB output, with no visible quality loss.
//
// Files that are already small (< 200 KB) are returned untouched.
// PDFs and any non-jpeg input are also returned untouched — there's no point
// re-compressing them client-side.

const isJpeg = (file) =>
  /^image\/jpe?g$/i.test(file?.type || "") || /\.(jpe?g)$/i.test(file?.name || "");

export async function compressImageIfPossible(file, {
  maxDim  = 1600,
  quality = 0.8,
  minSize = 200 * 1024, // skip files already under 200 KB
} = {}) {
  if (!file) return file;
  if (!isJpeg(file)) return file;          // Only JPEG gets compressed
  if (file.size < minSize) return file;    // Already small enough

  // Decode the file into an HTMLImageElement we can draw on a canvas.
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload  = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  // Compute output dimensions (preserve aspect ratio, cap longer side).
  const longer = Math.max(img.width, img.height);
  const scale  = longer > maxDim ? maxDim / longer : 1;
  const w = Math.round(img.width  * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  // Re-encode to JPEG.
  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) return file; // canvas failed for some reason

  // Wrap the blob back into a File so the form-data field has a sensible name.
  const compressed = new File([blob], file.name.replace(/\.(jpe?g)$/i, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  // If compression somehow produced a bigger file (rare for already-low-quality
  // sources), keep the original.
  return compressed.size < file.size ? compressed : file;
}

export default compressImageIfPossible;
