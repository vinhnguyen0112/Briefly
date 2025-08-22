const processedImages = new Set();

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
    const response = await fetch(
      "https://capstone-2025.coccoc.com/api/query/captionize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: images, context: content }),
      }
    );

    if (!response.ok) {
      return images.map(() => null);
    }

    const data = await response.json();
    return Array.isArray(data.captions)
      ? data.captions
      : images.map(() => null);
  } catch (error) {
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
