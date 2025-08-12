const processedImages = new Set();
import { sendRequest } from "./state.js";

export async function handleCaptionImages(imageUrls, content) {
  const newImages = imageUrls.filter((img) => !processedImages.has(img));

  if (newImages.length === 0) {
    console.log("All images already captioned, skipping.");
    return [];
  }

  newImages.forEach((img) => processedImages.add(img));

  let captions = await callCaptionApi(newImages, content);

  const validCaptions = [];
  const retryList = [];

  captions.forEach((caption, index) => {
    const src = newImages[index];
    if (caption && caption.trim()) {
      validCaptions.push({ src, caption });
    } else {
      retryList.push(src);
    }
  });

  for (const imgSrc of retryList) {
    let retryCount = 0;
    let caption = null;
    while (retryCount < 3 && (!caption || caption.trim() === "")) {
      const [retryCaption] = await callCaptionApi([imgSrc], content);
      caption = retryCaption;
      retryCount++;
    }
    if (caption && caption.trim()) {
      validCaptions.push({ src: imgSrc, caption });
    }
  }

  return validCaptions.map((item) => item.caption);
}

async function callCaptionApi(images, content) {
  console.log("Sending to caption API:", { sources: images, content });

  try {
    const data = await sendRequest(
      "http://localhost:3000/api/query/captionize",
      {
        method: "POST",
        body: { sources: images, context: content },
      }
    );

    console.log("Caption API response:", data);

    if (data.success && data.data && Array.isArray(data.data.captions)) {
      console.log(`Received ${data.data.captions.length} captions`);
      return data.data.captions;
    } else {
      console.error("Invalid response structure:", data);
      return images.map(() => null);
    }
  } catch (error) {
    console.error("Caption API error:", error);
    return images.map(() => null);
  }
}

export function resetProcessedImages() {
  console.log(
    "Resetting processedImages set. Before reset:",
    Array.from(processedImages)
  );
  processedImages.clear();
  console.log(
    "After reset, processedImages set is now:",
    Array.from(processedImages)
  );
}
