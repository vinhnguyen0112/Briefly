export const processedImagesByTab = {};

import { sendRequest } from "./state.js";

const MAX_TOTAL_CAPTIONS_PER_TAB = 100;

export async function handleCaptionImages(imageUrls, content, tabId) {
  if (!processedImagesByTab[tabId]) processedImagesByTab[tabId] = {};
  const store = processedImagesByTab[tabId];

  const currentCaptionCount = Object.keys(store).length;

  if (currentCaptionCount >= MAX_TOTAL_CAPTIONS_PER_TAB) {
    console.warn(
      `[Caption][limit] Tab ${tabId} has ${currentCaptionCount} captions (max: ${MAX_TOTAL_CAPTIONS_PER_TAB}). No more images will be extracted!`
    );
    return Object.entries(store).map(([src, caption]) => ({ src, caption }));
  }

  const imagesWithCaption = [];
  const imagesToCaption = [];

  imageUrls.forEach((src) => {
    if (store[src]) {
      imagesWithCaption.push({ src, caption: store[src] });
    } else {
      imagesToCaption.push(src);
    }
  });

  const availableSlots = MAX_TOTAL_CAPTIONS_PER_TAB - currentCaptionCount;
  const limitedImagesToCaption = imagesToCaption.slice(0, availableSlots);

  const validCaptions = [...imagesWithCaption];
  const retryList = [];

  if (limitedImagesToCaption.length > 0) {
    const captions = await callCaptionApi(limitedImagesToCaption, content);

    captions.forEach((caption, index) => {
      const src = limitedImagesToCaption[index];
      if (caption && caption.trim()) {
        store[src] = caption;
        validCaptions.push({ src, caption });
      } else {
        retryList.push(src);
      }
    });

    for (const imgSrc of retryList) {
      let retryCount = 0;
      let caption = null;

      while (
        retryCount < 1 &&
        (!caption || caption.trim() === "") &&
        Object.keys(store).length < MAX_TOTAL_CAPTIONS_PER_TAB
      ) {
        retryCount++;
        const [retryCaption] = await callCaptionApi([imgSrc], content);
        caption = retryCaption;
      }
      if (caption && caption.trim()) {
        store[imgSrc] = caption;
        validCaptions.push({ src: imgSrc, caption });
      }
    }
  }

  console.log(
    `[Caption] Tab ${tabId} summary: cache=${imagesWithCaption.length}, api=${
      validCaptions.length - imagesWithCaption.length
    }`
  );
  return validCaptions;
}

async function callCaptionApi(images, content) {
  console.log("Sending to caption API:", { sources: images, content });

  try {
    const data = await sendRequest(
      "https://dev-capstone-2025.coccoc.com/api/query/captionize",
      {
        method: "POST",
        body: { sources: images, context: content },
      }
    );

    if (data.success && data.data && Array.isArray(data.data.captions)) {
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

export function resetProcessedImages(tabId) {
  if (tabId) {
    processedImagesByTab[tabId] = {};
    console.log(`[Caption] Reset processed images for tab ${tabId}`);
  } else {
    Object.keys(processedImagesByTab).forEach(
      (tid) => (processedImagesByTab[tid] = {})
    );
    console.log("[Caption] Reset processed images for all tabs");
  }
}
