import * as pdfjs from "../../libs/pdfjs/pdf.mjs";

/**
 * Stream-extracts PDF content and metadata.
 * Updates state after each page read.
 *
 * @param {string} pdfUrl PDF file URL
 * @param {(partial: { page: number, totalPages: number, content: string, metadata: object | null }) => void} onProgress Callback on each page
 * @returns {Promise<{ numPages: number, metadata: object | null }>}
 */
export async function extractTextFromPDF(pdfUrl, onProgress) {
  try {
    console.log("Extracting text from PDF:", pdfUrl);

    // Set PDF.js worker
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "libs/pdfjs/pdf.worker.mjs"
    );

    // Process PDF
    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // Handle metadata
    const meta = await pdf.getMetadata();
    console.log("Metadata:", meta);

    const metadata = {
      title: meta.info?.Title ?? null,
      author: meta.info?.Author ?? null,
      subject: meta.info?.Subject ?? null,
      keywords: meta.info?.Keywords ?? null,
      language: meta.info?.Language ?? null,
      creator: meta.info?.Creator ?? null,
      producer: meta.info?.Producer ?? null,
      creationDate: meta.info?.CreationDate ?? null,
      modificationDate: meta.info?.ModDate ?? null,
    };

    // Read pages
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => item.str?.trim())
        .filter((str) => str)
        .join(" ");

      fullText += `${pageText} `;

      // Send partial update after each page
      onProgress?.({
        page: pageNum,
        totalPages: pdf.numPages,
        content: fullText,
        metadata,
      });
    }

    return {
      totalPages: pdf.numPages,
      metadata,
      status: "success",
    };
  } catch (err) {
    console.error("Failed to extract text or metadata from PDF:", err);
    return {
      numPages: null,
      metadata: null,
      status: "failed",
    };
  }
}

/**
 * Converts a PDF date string (e.g. "D:20180526231518+12'00'") into a readable format.
 * @param {string} pdfDate
 * @param {boolean} [dateOnly=false] - If true, only returns date without time.
 * @returns {string} Formatted date or original if parsing fails.
 */
export function formatPdfDate(pdfDate, dateOnly = false) {
  if (!pdfDate || !pdfDate.startsWith("D:")) return pdfDate;

  try {
    const dateStr = pdfDate.slice(2); // Remove "D:"
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.slice(6, 8));
    const hour = parseInt(dateStr.slice(8, 10));
    const minute = parseInt(dateStr.slice(10, 12));
    const second = parseInt(dateStr.slice(12, 14));

    let timezoneOffset = "Z";
    const tzSign = dateStr[14];
    if (tzSign === "+" || tzSign === "-") {
      const tzHour = dateStr.slice(15, 17);
      const tzMin = dateStr.slice(18, 20);
      timezoneOffset = `${tzSign}${tzHour}:${tzMin}`;
    }

    const iso = `${year}-${(month + 1).toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:${second
      .toString()
      .padStart(2, "0")}${timezoneOffset}`;

    const date = new Date(iso);

    if (dateOnly) {
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch (err) {
    console.warn("Failed to parse PDF date:", pdfDate, err);
    return pdfDate;
  }
}
