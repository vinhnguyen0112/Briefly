// Grabs the good stuff from webpages

// Make this available globally
window.extractPageContent = extractPageContent;

// Check if we're good to go
window.isContentExtractorReady = function () {
  return typeof window.extractPageContent === "function";
};

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
  const images = document.querySelectorAll("img");
  const newImages = [];

  images.forEach((img) => {
    let src =
      img.currentSrc ||
      img.src ||
      img.getAttribute("data-src") ||
      img.getAttribute("srcset");
    if (src && src.includes(",")) {
      src = src.split(",")[0].trim().split(" ")[0];
    }
    if (!isSupportedImageFormat(src)) return;
    if (isLogoOrIcon(img, src)) return;
    if (/ads\.|tracker\.|pixel\./i.test(src)) return;
    // const normalizedSrc = src.split("?")[0];
    // if (!sentImages.has(normalizedSrc)) {
    //   sentImages.add(normalizedSrc);
    //   newImages.push(src);
    // }
    if (!sentImages.has(src)) {
      sentImages.add(src);
      newImages.push(src);
    }
  });

  return newImages;
}

let emptyCount = 0;
const maxEmptyRounds = 5;

async function autoSendImagesLoop(interval = 3000) {
  while (emptyCount < maxEmptyRounds) {
    const newImages = extractAllImageSources();
    if (newImages.length > 0) {
      console.log(`🚀 [Loop] Sending ${newImages.length} new images to API`);
      chrome.runtime.sendMessage({
        action: "process_images",
        images: newImages,
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
  console.log("⏹️ [Loop] Stopping image loop after max empty rounds");
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
      });
    } else {
      console.log("👀 [Observer] No new images detected in mutation");
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "data-src", "srcset"],
  });

  console.log("🔍 [Observer] MutationObserver is now watching for new images");
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

// 🚀 Start auto image extraction loop, then fallback to MutationObserver
waitForDomReady(() => {
  sentImages.clear();
  console.log("✅ [Init] DOM ready, starting image monitoring loop");
  autoSendImagesLoop(3000);
});

// ===================================== // ================================

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
