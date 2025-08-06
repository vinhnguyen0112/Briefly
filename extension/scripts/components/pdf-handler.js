import * as pdfjs from "../../libs/pdfjs/pdf.mjs";

/**
 * Extracts all text content from a PDF file using PDF.js.
 *
 * Returns null if unable to read from PDF.
 * @param {string} pdfUrl PDF's URL
 * @returns {Promise<{numPages: number, content: String}>} Result object
 */
export async function extractTextFromPDF(pdfUrl) {
  try {
    // Set the PDF.js worker script
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "libs/pdfjs/pdf.worker.mjs"
    );

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    let fullText = "";

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) => item.str?.trim())
          .filter((str) => str)
          .join(" ");

        fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
      } catch (err) {
        console.warn(`Failed to extract text from page ${pageNum}:`, err);
      }
    }

    return {
      numPages: pdf.numPages,
      content: fullText,
    };
  } catch (err) {
    console.error("Error initializing PDF.js:", err);
    return {
      numPages: null,
      content: null,
    };
  }
}
