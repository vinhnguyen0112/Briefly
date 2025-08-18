// Grabs the good stuff from webpages

// Make this available globally
window.extractPageContent = extractPageContent;

// Check if we're good to go
window.isContentExtractorReady = function () {
  return typeof window.extractPageContent === "function";
};

const sendDetected = (pdfUrl) => {
  // Send a message to the background script
  chrome.runtime.sendMessage({
    action: "pdf_detected",
    pdf_url: pdfUrl,
    page_url: window.location.href,
  });
};

/**
 * Detect for PDF contents on the page.
 * @returns {Promise<void>}
 */
async function detectPDF() {
  // Detect if this is a PDF document
  const url = window.location.href;

  // Check if the URL ends with .pdf or has a PDF content type
  if (url.toLowerCase().endsWith(".pdf")) return sendDetected(url);

  // Check if the content type is PDF
  if (document.contentType === "application/pdf") return sendDetected(url);

  // Check for <embed> or <object> tags with PDF content
  const embeds = [...document.getElementsByTagName("embed")];
  const objects = [...document.getElementsByTagName("object")];

  // Check if any embed or object has a PDF type
  if (
    embeds.find((e) => e.type?.includes("pdf")) ||
    objects.find((o) => o.type?.includes("pdf"))
  ) {
    return sendDetected(url);
  }

  // Check for <iframe> tags with PDF content
  if (url.includes("viewer.html") && url.includes("file=")) {
    try {
      const params = new URLSearchParams(url.split("?")[1]);
      const file = params.get("file");
      if (file) {
        const absoluteUrl = new URL(
          decodeURIComponent(file),
          window.location.origin
        ).href;
        return sendDetected(absoluteUrl);
      }
    } catch (e) {
      console.warn("Failed to extract PDF from viewer URL:", e);
      return sendDetected(url);
    }
  }

  // Check for iframes that might contain PDF viewers
  const iframes = [...document.getElementsByTagName("iframe")];
  for (const iframe of iframes) {
    const src = iframe.src || iframe.getAttribute("src") || "";
    if (src.includes("viewer.html") && src.includes("file=")) {
      try {
        const params = new URLSearchParams(src.split("?")[1]);
        const file = params.get("file");
        if (file) {
          const absoluteUrl = new URL(
            decodeURIComponent(file),
            window.location.origin
          ).href;
          return sendDetected(absoluteUrl);
        }
      } catch (e) {
        console.warn("Failed to extract PDF from iframe viewer:", e);
        return sendDetected(); // fallback if error
      }
    }
  }
}

// Boot up
(function initializeContentExtractor() {
  console.log("CocBot: Content Extractor initialized");
  window.COCBOT_CONTENT_EXTRACTOR_READY = true;
})();

// ---------------- INTEGRATED CONTENT & IMAGE EXTRACTION ----------------

const MAX_IMAGES_PER_PAGE = 10;

// The main show - pull content from the page
function extractPageContent() {
  console.log("CocBot: Starting integrated content & image extraction");

  try {
    // Grab the basics
    const pageMetadata = {
      title: document.title || "Untitled Page",
      url: window.location.href,
      selection: window.getSelection().toString(),
      timestamp: new Date().toISOString(),
      language: document.documentElement.lang,
    };

    console.log("CocBot: Metadata collected", pageMetadata);

    // Get main content and meaningful containers
    let mainContent = "";
    let meaningfulContainers = [];

    // 1. Try main element first (most semantic)
    const mainElements = document.querySelectorAll("main");
    if (mainElements.length > 0) {
      console.log("CocBot: Found", mainElements.length, "main elements");
      for (const main of mainElements) {
        if (isVisible(main) && hasSubstantialContent(main)) {
          mainContent += main.innerText + "\n\n";
          meaningfulContainers.push(main);
        }
      }
    }

    // 2. Try content-specific divs (often more reliable than article)
    if (mainContent.trim() === "") {
      const contentDivSelectors = [
        ".entry-content", // WordPress and other CMS khác
        ".post-content", // Blog posts
        ".article-content", // News articles
        ".content", // Generic content
        ".page-content", // Static pages
        ".main-content", // Main content areas
        "#content",
        "#main-content",
        "#post-content",
        "#main",
        ".container .content", // Nested content
        ".wrapper .content",
      ];

      const contentDivs = document.querySelectorAll(
        contentDivSelectors.join(", ")
      );
      if (contentDivs.length > 0) {
        console.log("CocBot: Found", contentDivs.length, "content divs");
        for (const div of contentDivs) {
          if (isVisible(div) && hasSubstantialContent(div)) {
            mainContent += div.innerText + "\n\n";
            meaningfulContainers.push(div);
          }
        }
      }
    }

    // 3. Try article elements, but filter out small ones (likely thumbnails)
    if (mainContent.trim() === "") {
      const articles = document.querySelectorAll("article");
      if (articles.length > 0) {
        console.log("CocBot: Found", articles.length, "article elements");
        // Sort articles by content length, take the longest ones
        const substantialArticles = Array.from(articles)
          .filter(
            (article) => isVisible(article) && hasSubstantialContent(article)
          )
          .sort((a, b) => b.innerText.length - a.innerText.length);

        for (const article of substantialArticles) {
          mainContent += article.innerText + "\n\n";
          meaningfulContainers.push(article);
        }
      }
    }

    // 4. Try other semantic containers
    if (mainContent.trim() === "") {
      const otherSelectors = [".article", ".post", "#article", "#post"];

      const otherContainers = document.querySelectorAll(
        otherSelectors.join(", ")
      );
      if (otherContainers.length > 0) {
        console.log(
          "CocBot: Found",
          otherContainers.length,
          "other containers"
        );
        for (const container of otherContainers) {
          if (isVisible(container) && hasSubstantialContent(container)) {
            mainContent += container.innerText + "\n\n";
            meaningfulContainers.push(container);
          }
        }
      }
    }

    // 5. Last resort - headings and paragraphs
    if (mainContent.trim() === "") {
      console.log("CocBot: Using headings and paragraphs for content");
      meaningfulContainers.push(document.body);

      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const heading of headings) {
        if (isVisible(heading)) {
          mainContent += heading.innerText + "\n";
        }
      }

      const paragraphs = document.querySelectorAll("p");
      for (const paragraph of paragraphs) {
        if (isVisible(paragraph)) {
          mainContent += paragraph.innerText + "\n\n";
        }
      }

      const listItems = document.querySelectorAll("li");
      for (const item of listItems) {
        if (isVisible(item) && !item.querySelector("li")) {
          mainContent += "- " + item.innerText + "\n";
        }
      }
    }

    // 6. Just take the whole body if nothing worked
    if (mainContent.trim() === "") {
      console.log("CocBot: Using body content as fallback");
      mainContent = document.body.innerText;
      meaningfulContainers.push(document.body);
    }

    // Make sure we have something
    if (!mainContent || mainContent.trim() === "") {
      console.log("CocBot: No content found, using page title and URL");
      mainContent = `Page Title: ${document.title}\nURL: ${window.location.href}\n\nNo text content could be extracted from this page. It might be a special page, an image, or have dynamically loaded content.`;
    }

    // Clean up the text
    mainContent = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();

    console.log("CocBot: Content extracted, length:", mainContent.length);

    // Extract images from meaningful containers
    const foundImages =
      extractImagesFromMeaningfulContainers(meaningfulContainers);

    // See if there's any structured data
    let structuredData = null;
    try {
      structuredData = extractStructuredData();
    } catch (err) {
      console.error("CocBot: Error extracting structured data:", err);
    }

    const result = {
      ...pageMetadata,
      content: mainContent,
      structuredData: structuredData,
      captions: [], // Empty initially - will be populated by caption results
      extractionSuccess: true,
      imagesProcessing: foundImages.length > 0, // Flag to indicate images are being processed
    };

    console.log(
      `VH: "${pageMetadata.title}" - Found images for processing`,
      foundImages
    );

    // Send images for captioning if found (async, non-blocking)
    if (foundImages.length > 0) {
      console.log(
        `VH: Found ${foundImages.length} images, sending for captioning`
      );
      chrome.runtime.sendMessage({
        action: "process_images",
        images: foundImages,
        content: mainContent,
      });
    }

    console.log("CocBot: Content extraction complete");
    return result;
  } catch (error) {
    console.error("CocBot: Content extraction error:", error);
    // At least return something if we fail
    return {
      title: document.title || "Error Page",
      url: window.location.href,
      content:
        "An error occurred while extracting content from this page. " +
        error.message,
      timestamp: new Date().toISOString(),
      extractionSuccess: false,
      error: error.message,
      captions: [],
      imagesProcessing: false,
    };
  }
}

// Helper function to check if element has substantial content
function hasSubstantialContent(element) {
  const text = element.innerText || "";
  const wordCount = text.trim().split(/\s+/).length;

  // Consider substantial if:
  // - Has more than 50 words, OR
  // - Has multiple paragraphs/headings, OR
  // - Contains article-like structure
  const hasEnoughWords = wordCount > 50;
  const hasMultipleParagraphs = element.querySelectorAll("p").length > 2;
  const hasHeadings = element.querySelectorAll("h1,h2,h3,h4,h5,h6").length > 0;
  const hasLists = element.querySelectorAll("ul, ol").length > 0;

  return hasEnoughWords || hasMultipleParagraphs || hasHeadings || hasLists;
}

// Extract images only from containers that have meaningful content
function extractImagesFromMeaningfulContainers(containers) {
  if (!containers || containers.length === 0) return [];

  const foundImages = [];
  const imageSet = new Set();

  for (const container of containers) {
    const images = container.querySelectorAll("img");

    for (const img of images) {
      if (foundImages.length >= MAX_IMAGES_PER_PAGE) break;

      // Expand data attributes for lazy loading + check alt attribute
      let src =
        img.currentSrc ||
        img.src ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-srcset") ||
        img.getAttribute("data-background-image") ||
        img.getAttribute("srcset") ||
        // Add alt attribute check for special cases like uk-img
        (img.getAttribute("alt") && img.getAttribute("alt").startsWith("http")
          ? img.getAttribute("alt")
          : null);

      // Handle srcset format
      if (src && src.includes(",")) {
        src = src.split(",")[0].trim().split(" ")[0];
      }

      // Check for CSS background images if no src found
      if (!src) {
        const computedStyle = window.getComputedStyle(img);
        const bgImage = computedStyle.backgroundImage;
        if (bgImage && bgImage !== "none") {
          const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
          if (match) src = match[1];
        }
      }

      // Also check for uk-img specific behavior - wait for it to load
      if (!src && img.hasAttribute("uk-img")) {
        // uk-img might set src after initialization
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "src"
            ) {
              const newSrc = img.src;
              if (
                newSrc &&
                !imageSet.has(newSrc) &&
                isSupportedImageFormat(newSrc)
              ) {
                imageSet.add(newSrc);
                foundImages.push(newSrc);
              }
            }
          });
        });
        observer.observe(img, { attributes: true });

        // Disconnect after a short delay
        setTimeout(() => observer.disconnect(), 2000);
      }

      if (!src || imageSet.has(src)) continue;
      if (!isSupportedImageFormat(src)) continue;
      if (isLogoOrIcon(img, src)) continue;
      if (/ads\.|tracker\.|pixel\.|analytics\./i.test(src)) continue;

      imageSet.add(src);
      foundImages.push(src);
    }

    // Also check for CSS background images on divs/containers
    const bgImageElements = container.querySelectorAll(
      '[style*="background-image"], .hero-image, .featured-image'
    );
    for (const element of bgImageElements) {
      if (foundImages.length >= MAX_IMAGES_PER_PAGE) break;

      const computedStyle = window.getComputedStyle(element);
      const bgImage = computedStyle.backgroundImage;
      if (bgImage && bgImage !== "none") {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match) {
          const src = match[1];
          if (
            !imageSet.has(src) &&
            isSupportedImageFormat(src) &&
            !isLogoOrIcon(element, src)
          ) {
            imageSet.add(src);
            foundImages.push(src);
          }
        }
      }
    }
  }

  console.log(
    `CocBot: Extracted ${foundImages.length} images from meaningful containers`
  );
  return foundImages;
}

function isSupportedImageFormat(src) {
  if (!src || src.startsWith("data:image")) return false;
  try {
    // Handle both relative and absolute URLs
    const url = new URL(src, window.location.href);
    const pathname = url.pathname.toLowerCase();
    const ext = pathname.split(".").pop();
    return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  } catch {
    // Fallback for malformed URLs
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(src);
  }
}

function isLogoOrIcon(img, src) {
  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;

  // Consider small images as logos/icons
  const isSmall = width < 250 || height < 250;

  // Check file name patterns
  const isLogoFile = /\b(logo|icon|avatar|profile|favicon)\b/i.test(src || "");

  // Check alt text patterns
  const altText = img.getAttribute("alt") || "";
  const isLogoAlt = /\b(logo|icon|avatar)\b/i.test(altText);

  return isSmall || isLogoFile || isLogoAlt;
}

function waitForDomReady(callback) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    callback();
  } else {
    document.addEventListener("DOMContentLoaded", callback);
  }
}

waitForDomReady(() => {
  detectPDF(); // detect for PDFs when DOM is ready
});

// Can we see this element?
function isVisible(element) {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

// Grab any fancy structured data
function extractStructuredData() {
  const result = {};

  // Look for JSON-LD
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  if (jsonLdScripts.length > 0) {
    const jsonLdData = [];
    for (const script of jsonLdScripts) {
      try {
        jsonLdData.push(JSON.parse(script.textContent));
      } catch (e) {
        console.error("Error parsing JSON-LD:", e);
      }
    }
    if (jsonLdData.length > 0) {
      result.jsonLd = jsonLdData;
    }
  }

  // Check for API documentation-specific elements
  const apiElements = document.querySelectorAll(
    ".api, .endpoint, .method, .parameter, .response"
  );
  if (apiElements.length > 0) {
    const apiDocs = [];
    for (const element of apiElements) {
      apiDocs.push({
        type: element.className,
        content: element.innerText,
      });
    }
    result.apiDocumentation = apiDocs;
  }

  // Look for tables which often contain structured data
  const tables = document.querySelectorAll("table");
  if (tables.length > 0) {
    const tableData = [];
    for (const table of tables) {
      if (isVisible(table)) {
        const tableObj = { headers: [], rows: [] };

        const headers = table.querySelectorAll("th");
        for (const header of headers) {
          tableObj.headers.push(header.innerText.trim());
        }

        const rows = table.querySelectorAll("tr");
        for (const row of rows) {
          if (!row.querySelector("th")) {
            const rowData = [];
            const cells = row.querySelectorAll("td");
            for (const cell of cells) {
              rowData.push(cell.innerText.trim());
            }
            if (rowData.length > 0) {
              tableObj.rows.push(rowData);
            }
          }
        }

        if (tableObj.headers.length > 0 || tableObj.rows.length > 0) {
          tableData.push(tableObj);
        }
      }
    }
    if (tableData.length > 0) {
      result.tables = tableData;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
