const processedImages = new Set();

const SERVER_URL = "http://localhost:3000";
const MAX_CAPTIONS_PER_PAGE = 5;

/**
 * Generates or gets cached captions for image URLs.
 */
export async function handleCaptionImages(imageUrls, content, pageUrl) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];

  // Get all cached captions for this page
  let cachedCaptions = [];
  try {
    cachedCaptions = await idbHandler.getCaptionsByPage(pageUrl || "");
  } catch (e) {
    console.warn("[Caption] IDB lookup failed, fallback to API:", e);
  }

  // If already have max captions cached, return directly
  if (cachedCaptions.length >= MAX_CAPTIONS_PER_PAGE) {
    return cachedCaptions.slice(0, MAX_CAPTIONS_PER_PAGE).map((c) => ({
      src: c.img_url,
      caption: c.caption,
    }));
  }

  // try cached captions for input images
  let cached = new Map();
  try {
    cached = await idbHandler.getCaptionsByPageAndImageUrls(
      pageUrl || "",
      imageUrls
    );
  } catch (e) {
    console.warn("[Caption] IDB lookup failed, fallback to API:", e);
  }

  const need = []; // images that need captioning
  const captionsMap = new Map(); // url: caption

  for (const src of imageUrls) {
    const entry = cached.get(src);
    if (entry?.caption?.trim()) {
      captionsMap.set(src, entry.caption);
    } else {
      retryList.push(src);
    }
  }

  // only process up to available slots
  const availableSlots = MAX_CAPTIONS_PER_PAGE - cachedCaptions.length;
  if (need.length > availableSlots) {
    need.length = availableSlots;
  }

  if (need.length > 0) {
    // get caption
    let captions = await callCaptionApi(need, content);

    // retry all failed at once
    const retryTargets = need.filter((_, i) => !captions[i]?.trim());
    if (retryTargets.length > 0) {
      const retryCaptions = await callCaptionApi(retryTargets, content);
      retryTargets.forEach((src, i) => {
        const cap = retryCaptions[i]?.trim();
        if (cap) captions[need.indexOf(src)] = cap;
      });
    }

    // push new captions
    need.forEach((src, i) => {
      const cap = captions[i]?.trim();
      if (cap) captionsMap.set(src, cap);
    });
  }

  // Combine cached captions and new ones
  const allCaptions = [
    ...cachedCaptions.map((c) => ({
      src: c.img_url,
      caption: c.caption,
    })),
    ...imageUrls
      .map((src) =>
        captionsMap.get(src) ? { src, caption: captionsMap.get(src) } : null
      )
      .filter(Boolean)
      .filter((c) => !cachedCaptions.some((cc) => cc.img_url === c.src)),
  ].slice(0, MAX_CAPTIONS_PER_PAGE);

  console.log(
    `[Caption] cached=${cachedCaptions.length}, api=${
      allCaptions.length - cachedCaptions.length
    }, total=${allCaptions.length}`
  );
  return allCaptions;
}

async function callCaptionApi(images, content) {
  console.log("Sending to caption API:", { sources: images, content });

  try {
    const data = await sendRequest(`${SERVER_URL}/api/query/captionize`, {
      method: "POST",
      body: { sources: images, context: content },
    });
    if (data.success && data.data && Array.isArray(data.data.captions)) {
      return data.data.captions;
    }
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
