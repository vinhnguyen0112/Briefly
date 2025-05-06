const processedImages = new Set();

export async function handleCaptionImages(imageUrls) {
  const newImages = imageUrls.filter((img) => !processedImages.has(img));

  if (newImages.length === 0) {
    console.log("All images already captioned, skipping.");
    return [];
  }

  newImages.forEach((img) => processedImages.add(img));

  const captions = await callCaptionApi(newImages);

  const nullCount = captions.filter((c) => c == null || c.trim() === "").length;
  const nullRatio = nullCount / captions.length;

  console.log(
    `📊 Captions received: ${captions.length}, nulls: ${nullCount}, ratio: ${(
      nullRatio * 100
    ).toFixed(2)}%`
  );

  // Retry once if ≥30% are null
  if (nullRatio >= 0.3) {
    console.log("🔄 High null ratio, retrying once...");
    const retryCaptions = await callCaptionApi(newImages);
    return retryCaptions.filter((c) => c != null && c.trim() !== "");
  }

  return captions.filter((c) => c != null && c.trim() !== "");
}

async function callCaptionApi(images) {
  try {
    const response = await fetch("http://localhost:3000/api/image-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: images }),
    });

    if (!response.ok) {
      console.error("Caption API responded with error:", response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.captions) ? data.captions : [];
  } catch (error) {
    console.error("Caption Handler: Error", error);
    return [];
  }
}

export function resetProcessedImages() {
  processedImages.clear();
}
