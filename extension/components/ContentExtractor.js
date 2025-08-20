// Grabs the good stuff from webpages

// Make this available globally
window.extractPageContent = extractPageContent;

// Check if we're good to go
window.isContentExtractorReady = function () {
  return typeof window.extractPageContent === "function";
};

const sendDetected = (pdfUrl, detectionMethod = "unknown") => {
  chrome.runtime.sendMessage({
    action: "pdf_detected",
    pdf_url: pdfUrl,
    page_url: window.location.href,
    detection_method: detectionMethod,
    timestamp: Date.now(),
  });
};

/**
 * Check if a URL looks like a PDF based on various patterns
 */
const isPdfUrl = (url) => {
  if (!url) return false;

  const cleanUrl = url.toLowerCase().split("?")[0].split("#")[0];

  // Direct PDF file extensions
  if (cleanUrl.endsWith(".pdf")) return true;

  // Common PDF viewer patterns
  const pdfPatterns = [
    /\/pdf\//i,
    /\.pdf[?#]/i,
    /pdfjs/i,
    /pdf\.js/i,
    /viewer\.html.*\.pdf/i,
    /\/view\/pdf/i,
    /\/download.*\.pdf/i,
    /content-type.*application\/pdf/i,
  ];

  return pdfPatterns.some((pattern) => pattern.test(url));
};

/**
 * Check content type via fetch HEAD request
 */
const checkContentType = async (url) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-cache",
    });
    const contentType = response.headers.get("content-type");
    return contentType && contentType.toLowerCase().includes("application/pdf");
  } catch (e) {
    return false;
  }
};

/**
 * Extract PDF URL from various viewer formats
 */
const extractPdfFromViewer = (url) => {
  try {
    // PDF.js viewer format: viewer.html?file=...
    if (url.includes("viewer.html") && url.includes("file=")) {
      const params = new URLSearchParams(url.split("?")[1]);
      const file = params.get("file");
      if (file) {
        return new URL(decodeURIComponent(file), window.location.origin).href;
      }
    }

    // Google Drive viewer
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch) {
      return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    // Other common viewer patterns
    const viewerPatterns = [
      /[?&]url=([^&]+)/i,
      /[?&]src=([^&]+)/i,
      /[?&]document=([^&]+)/i,
      /[?&]file=([^&]+)/i,
    ];

    for (const pattern of viewerPatterns) {
      const match = url.match(pattern);
      if (match) {
        try {
          const extractedUrl = decodeURIComponent(match[1]);
          if (isPdfUrl(extractedUrl)) {
            return new URL(extractedUrl, window.location.origin).href;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to extract PDF from viewer URL:", e);
  }
  return null;
};

/**
 * Check for PDF content in DOM elements
 */
const checkDomElements = () => {
  const elements = [
    ...document.getElementsByTagName("embed"),
    ...document.getElementsByTagName("object"),
    ...document.getElementsByTagName("iframe"),
  ];

  for (const element of elements) {
    // Check type attribute
    const type = element.type || element.getAttribute("type") || "";
    if (type.toLowerCase().includes("pdf")) {
      const src =
        element.src ||
        element.data ||
        element.getAttribute("src") ||
        element.getAttribute("data");
      if (src) {
        const extractedPdf = extractPdfFromViewer(src) || src;
        return {
          url: extractedPdf,
          method: `${element.tagName.toLowerCase()}_type`,
        };
      }
    }

    // Check src/data attributes for PDF patterns
    const src =
      element.src ||
      element.data ||
      element.getAttribute("src") ||
      element.getAttribute("data") ||
      "";
    if (isPdfUrl(src)) {
      const extractedPdf = extractPdfFromViewer(src) || src;
      return {
        url: extractedPdf,
        method: `${element.tagName.toLowerCase()}_src`,
      };
    }
  }

  return null;
};

/**
 * Check for PDF links and buttons
 */
const checkPdfLinks = () => {
  const links = document.querySelectorAll(
    "a[href], button[onclick], [data-pdf], [data-url]"
  );

  for (const link of links) {
    const href =
      link.href ||
      link.getAttribute("href") ||
      link.getAttribute("data-pdf") ||
      link.getAttribute("data-url") ||
      "";

    if (isPdfUrl(href)) {
      // Only report if the link is prominent (visible and reasonably sized)
      const rect = link.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 20) {
        return { url: href, method: "pdf_link" };
      }
    }

    // Check onclick handlers for PDF patterns
    const onclick = link.getAttribute("onclick") || "";
    const pdfMatch = onclick.match(/['"]([^'"]*\.pdf[^'"]*)['"]/i);
    if (pdfMatch) {
      return {
        url: new URL(pdfMatch[1], window.location.origin).href,
        method: "onclick_pdf",
      };
    }
  }

  return null;
};

/**
 * Check for canvas-based PDF renderers
 */
const checkCanvasRenderers = () => {
  const canvases = document.getElementsByTagName("canvas");

  // Look for multiple canvases which might indicate a PDF renderer
  if (canvases.length > 2) {
    // Check if there are PDF-related classes or IDs
    for (const canvas of canvases) {
      const className = canvas.className.toLowerCase();
      const id = canvas.id.toLowerCase();

      if (
        className.includes("pdf") ||
        id.includes("pdf") ||
        canvas.closest('[class*="pdf"], [id*="pdf"]')
      ) {
        return { url: window.location.href, method: "canvas_pdf_renderer" };
      }
    }
  }

  return null;
};

/**
 * Main PDF detection function
 */
async function detectPDF() {
  const url = window.location.href;

  // 1. Check if current page is a PDF
  if (url.toLowerCase().endsWith(".pdf")) {
    return sendDetected(url, "url_extension");
  }

  // 2. Check document content type
  if (document.contentType === "application/pdf") {
    return sendDetected(url, "content_type");
  }

  // 3. Check for PDF viewer URLs
  const extractedPdf = extractPdfFromViewer(url);
  if (extractedPdf) {
    return sendDetected(extractedPdf, "viewer_extraction");
  }

  // 4. Check DOM elements
  const domResult = checkDomElements();
  if (domResult) {
    return sendDetected(domResult.url, domResult.method);
  }

  // 5. Check for prominent PDF links
  const linkResult = checkPdfLinks();
  if (linkResult) {
    return sendDetected(linkResult.url, linkResult.method);
  }

  // 6. Check for canvas-based PDF renderers
  const canvasResult = checkCanvasRenderers();
  if (canvasResult) {
    return sendDetected(canvasResult.url, canvasResult.method);
  }

  // 8. Additional async checks
  setTimeout(async () => {
    // Check if any suspicious URLs in the page might be PDFs
    const suspiciousLinks = Array.from(
      document.querySelectorAll(
        'a[href*="download"], a[href*="view"], a[href*="file"]'
      )
    )
      .map((a) => a.href)
      .filter(isPdfUrl)
      .slice(0, 3); // Limit to prevent too many requests

    for (const suspiciousUrl of suspiciousLinks) {
      if (await checkContentType(suspiciousUrl)) {
        return sendDetected(suspiciousUrl, "async_content_type_check");
      }
    }
  }, 1000);
}

// Boot up
(function initializeContentExtractor() {
  console.log("CocBot: Content Extractor initialized");
  window.COCBOT_CONTENT_EXTRACTOR_READY = true;
})();

// The main show - pull content from the page
function extractPageContent() {
  console.log("CocBot: Starting content extraction");

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

    // Get main content - try a few approaches
    let mainContent = "";

    // 1. Try article elements first (common for blog posts, news articles)
    const articles = document.querySelectorAll("article");
    if (articles.length > 0) {
      console.log("CocBot: Found", articles.length, "article elements");
      for (const article of articles) {
        if (isVisible(article)) {
          mainContent += article.innerText + "\n\n";
        }
      }
    }

    // 2. Try main element
    const mainElements = document.querySelectorAll("main");
    if (mainElements.length > 0 && mainContent.trim() === "") {
      console.log("CocBot: Found", mainElements.length, "main elements");
      for (const main of mainElements) {
        if (isVisible(main)) {
          mainContent += main.innerText + "\n\n";
        }
      }
    }

    // 3. Check common content divs
    if (mainContent.trim() === "") {
      const contentDivSelectors = [
        ".content",
        ".article",
        ".post",
        ".post-content",
        ".entry-content",
        ".page-content",
        ".main-content",
        "#content",
        "#main",
        "#article",
        "#post",
      ];

      const contentDivs = document.querySelectorAll(
        contentDivSelectors.join(", ")
      );
      if (contentDivs.length > 0) {
        console.log("CocBot: Found", contentDivs.length, "content divs");
        for (const div of contentDivs) {
          if (isVisible(div)) {
            mainContent += div.innerText + "\n\n";
          }
        }
      }
    }

    // 4. Last resort - headings and paragraphs
    if (mainContent.trim() === "") {
      console.log("CocBot: Using headings and paragraphs for content");

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

    // 5. Just take the whole body if nothing worked
    if (mainContent.trim() === "") {
      console.log("CocBot: Using body content as fallback");
      mainContent = document.body.innerText;
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
      captions: collectedCaptions,
      extractionSuccess: true,
    };

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
    };
  }
}

// ---------------- IMAGE EXTRACTION + AUTO SEND LOOP ----------------

const sentImages = new Set();
let totalImagesSent = 0;
const MAX_IMAGES_PER_PAGE = 10;
let contentContext = null;

function isSupportedImageFormat(src) {
  if (!src || src.startsWith("data:image")) return false;
  try {
    const ext = new URL(src).pathname.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png"].includes(ext);
  } catch {
    return false;
  }
}

function isLogoOrIcon(img, src) {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const isSmall = width < 300 || height < 300;
  const isLogoFile = /\.(svg|logo)/i.test(src || "");
  return isSmall || isLogoFile;
}

function extractAllImageSources() {
  const mainSelectors = [
    "article",
    "main",
    ".content",
    ".article-feed",
    ".article",
    ".post",
    ".post-content",
    ".entry-content",
    ".page-content",
    ".main-content",
    "#content",
    "#main",
    "#article",
    "#post",
  ];

  const excludedContainers = [
    "header",
    "footer",
    "aside",
    ".sidebar",
    "#sidebar",
    ".nav",
    "#nav",
    ".related-posts",
    ".widget",
  ];

  const containers = [];

  for (const selector of mainSelectors) {
    const foundList = document.querySelectorAll(selector);
    for (const found of foundList) {
      if (isVisible(found)) {
        containers.push(found);
      }
    }
  }

  if (containers.length === 0) {
    console.log("No visible main content containers found, using <body>");
    containers.push(document.body);
  }

  const images = new Set();
  for (const container of containers) {
    const foundImages = container.querySelectorAll("img");
    for (const img of foundImages) {
      images.add(img);
    }
  }

  const newImages = [];
  for (const img of images) {
    if (totalImagesSent >= MAX_IMAGES_PER_PAGE) break;
    if (img.closest(excludedContainers.join(", "))) continue;

    let src =
      img.currentSrc ||
      img.src ||
      img.getAttribute("data-src") ||
      img.getAttribute("srcset");
    if (src && src.includes(",")) {
      src = src.split(",")[0].trim().split(" ")[0];
    }

    if (!isSupportedImageFormat(src)) continue;
    if (isLogoOrIcon(img, src)) continue;
    if (/ads\.|tracker\.|pixel\./i.test(src)) continue;
    if (sentImages.has(src)) continue;

    sentImages.add(src);
    newImages.push(src);
    totalImagesSent++;
  }

  if (totalImagesSent >= MAX_IMAGES_PER_PAGE) {
    console.log(
      `⚠️ Reached image captioning limit: ${MAX_IMAGES_PER_PAGE} images`
    );
  }

  console.log(
    `📸 Final: Collected ${newImages.length} image(s) from main content`
  );
  return newImages;
}

let emptyCount = 0;
const maxEmptyRounds = 5;

async function autoSendImagesLoop(interval = 3000) {
  while (emptyCount < maxEmptyRounds) {
    const newImages = extractAllImageSources();
    if (newImages.length > 0) {
      console.log(`[Loop] Sending ${newImages.length} new images to API`);
      chrome.runtime.sendMessage({
        action: "process_images",
        images: newImages,
        content: contentContext,
      });
      emptyCount = 0;
    } else {
      console.log(
        `💤 [Loop] No new images found (empty round ${emptyCount + 1})`
      );
      emptyCount++;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  console.log("[Loop] Stopping image loop after max empty rounds");
  startMutationObserver();
}

function startMutationObserver() {
  const observer = new MutationObserver(() => {
    const newImages = extractAllImageSources();
    if (newImages.length > 0) {
      console.log(
        `📸 [Observer] Sending ${newImages.length} new images to API`
      );
      chrome.runtime.sendMessage({
        action: "process_images",
        images: newImages,
        content: contentContext,
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "data-src", "srcset"],
  });

  console.log("MutationObserver is now watching for new images");
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
  detectPDF(); // detect if this is a PDF when DOM is ready
  sentImages.clear();
  totalImagesSent = 0;
  const extracted = extractPageContent();
  contentContext = extracted.content || "(no content)";
  // autoSendImagesLoop(3000);
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

        // headers
        const headers = table.querySelectorAll("th");
        for (const header of headers) {
          tableObj.headers.push(header.innerText.trim());
        }

        // rows
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
