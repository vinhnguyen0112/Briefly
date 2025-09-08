import { sendRequest } from "./state.js";
import idbHandler from "./idb-handler.js";

const SERVER_URL = "http://localhost:3000";

/**
 * Generates or get cached captions for a list of image URLs.
 * @param {Array<String>} imageUrls
 * @param {String} content
 * @param {String} pageUrl
 * @returns {Promise<Array<{src: String, caption: String}>>}
 */
export async function handleCaptionImages(imageUrls, content, pageUrl) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];

  let idbMap = new Map();
  try {
    idbMap = await idbHandler.getCaptionsByPageAndImageUrls(
      pageUrl || "",
      imageUrls
    );
  } catch (e) {
    console.warn(
      "[Caption] IDB lookup failed, will call API for all images:",
      e
    );
  }

  const need = [];
  const haveMap = new Map(); // Map<src, caption>

  for (const src of imageUrls) {
    const entry = idbMap.get(src);
    if (entry?.caption && entry.caption.trim()) {
      haveMap.set(src, entry.caption);
    } else {
      need.push(src);
    }
  }

  let apiPairs = [];
  if (need.length > 0) {
    // Get captions
    const captions = await callCaptionApi(need, content);

    // Handle retry
    const retryTargets = [];
    captions.forEach((cap, i) => {
      if (!cap || !cap.trim()) retryTargets.push(need[i]);
    });
    if (retryTargets.length > 0) {
      const retried = await Promise.all(
        retryTargets.map(async (src) => {
          const [cap] = await callCaptionApi([src], content);
          return { src, caption: cap || "" };
        })
      );
      const retryMap = new Map(retried.map((p) => [p.src, p.caption]));
      apiPairs = need.map((src, i) => ({
        src,
        caption: retryMap.get(src) ?? (captions[i] || ""),
      }));
    } else {
      apiPairs = need.map((src, i) => ({ src, caption: captions[i] || "" }));
    }
  }

  const apiMap = new Map(apiPairs.map((p) => [p.src, p.caption]));
  const result = imageUrls
    .map((src) => {
      const cap = haveMap.get(src) ?? apiMap.get(src) ?? "";
      return cap ? { src, caption: cap } : null;
    })
    .filter(Boolean);

  console.log(
    `[Caption] idb=${haveMap.size}, api=${apiPairs.length}, total=${result.length}`
  );
  return result;
}

async function callCaptionApi(images, content) {
  try {
    const data = await sendRequest(`${SERVER_URL}/api/query/captionize`, {
      method: "POST",
      body: { sources: images, context: content },
    });
    if (data.success && data.data && Array.isArray(data.data.captions)) {
      return data.data.captions;
    }
    console.error("Invalid response structure:", data);
    return images.map(() => "");
  } catch (error) {
    console.error("Caption API error:", error);
    return images.map(() => "");
  }
}
