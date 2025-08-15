class SessionCaptionCache {
  constructor() {
    this.memoryCache = new Map();
    this.processedImages = new Set(); // O(1) lookup thay vì O(n)
    this.loadProcessedImages();
  }

  loadProcessedImages() {
    try {
      const processed = JSON.parse(
        sessionStorage.getItem("processed_images") || "[]"
      );
      this.processedImages = new Set(processed);
    } catch {
      this.processedImages = new Set();
    }
  }

  getCaptions(url) {
    if (this.memoryCache.has(url)) {
      return this.memoryCache.get(url);
    }

    try {
      const sessionData = sessionStorage.getItem(`captions_${url}`);
      if (sessionData) {
        const captions = JSON.parse(sessionData);
        this.memoryCache.set(url, captions);
        return captions;
      }
    } catch (e) {
      console.warn("Session storage read error:", e);
    }

    return null;
  }

  setCaptions(url, captions) {
    this.memoryCache.set(url, captions);

    try {
      sessionStorage.setItem(`captions_${url}`, JSON.stringify(captions));
    } catch (e) {
      console.warn("Session storage write error:", e);
    }
  }

  hasProcessedImage(imageUrl) {
    return this.processedImages.has(imageUrl); // O(1) thay vì O(n)
  }

  markImageProcessed(imageUrl) {
    if (!this.processedImages.has(imageUrl)) {
      this.processedImages.add(imageUrl);
      this.syncProcessedImages();
    }
  }

  syncProcessedImages() {
    try {
      const array = Array.from(this.processedImages);
      sessionStorage.setItem("processed_images", JSON.stringify(array));
    } catch (e) {
      console.warn("Failed to sync processed images:", e);
    }
  }
}
