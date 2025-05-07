const processedImages = new Set();

export async function handleCaptionImages(imageUrls) {
  const newImages = imageUrls.filter((img) => !processedImages.has(img));

  if (newImages.length === 0) {
    console.log("All images already captioned, skipping.");
    return [];
  }

  newImages.forEach((img) => processedImages.add(img));

  // 🔥 Gọi API lần đầu
  let captions = await callCaptionApi(newImages);

  // Phân tách caption có / null
  const validCaptions = [];
  const retryList = [];

  captions.forEach((caption, index) => {
    const src = newImages[index];
    if (caption != null && caption.trim() !== "") {
      validCaptions.push({ src, caption });
    } else {
      retryList.push(src);
    }
  });

  console.log(
    `✅ Valid captions: ${validCaptions.length}, ⏳ Need retry: ${retryList.length}`
  );

  // 🌀 Retry từng ảnh trong retryList tối đa 3 lần
  for (const imgSrc of retryList) {
    let retryCount = 0;
    let caption = null;

    while (retryCount < 3 && (caption == null || caption.trim() === "")) {
      console.log(`🔄 Retrying ${imgSrc} (attempt ${retryCount + 1})`);
      const [retryCaption] = await callCaptionApi([imgSrc]);
      caption = retryCaption;
      retryCount++;
    }

    if (caption != null && caption.trim() !== "") {
      validCaptions.push({ src: imgSrc, caption });
      console.log(`✅ Got caption after ${retryCount} retries:`, caption);
    } else {
      console.warn(`❌ Failed to caption ${imgSrc} after 3 retries.`);
    }
  }

  // 👉 Trả về array chỉ chứa caption text (hoặc tuỳ bạn, có thể trả cả src+caption)
  return validCaptions.map((item) => item.caption);
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
      return images.map(() => null); // trả về null cho từng ảnh
    }

    const data = await response.json();
    return Array.isArray(data.captions)
      ? data.captions
      : images.map(() => null);
  } catch (error) {
    console.error("Caption Handler: Error", error);
    return images.map(() => null);
  }
}

export function resetProcessedImages() {
  console.log(
    "🧼 Resetting processedImages set. Before reset:",
    Array.from(processedImages)
  );
  processedImages.clear();
  console.log(
    "✅ After reset, processedImages set is now:",
    Array.from(processedImages)
  );
}
