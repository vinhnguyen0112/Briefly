import * as pdfjs from "../../libs/pdfjs/pdf.mjs";

/**
 * Extracts all text content and metadata from a PDF file using PDF.js.
 *
 * Returns nulls if unable to read from PDF.
 * @param {string} pdfUrl PDF's URL
 * @returns {Promise<{numPages: number, content: string, metadata: object | null}>}
 */
export async function extractTextFromPDF(pdfUrl) {
  try {
    console.log("Extracting text from PDF:", pdfUrl);

    // Set the PDF.js worker script
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "libs/pdfjs/pdf.worker.mjs"
    );

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => item.str?.trim())
        .filter((str) => str)
        .join(" ");

      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }

    const meta = await pdf.getMetadata();
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

    return {
      numPages: pdf.numPages,
      content: fullText,
      metadata,
    };
  } catch (err) {
    console.error("Failed to extract text or metadata from PDF:", err);
    return {
      numPages: null,
      content: null,
      metadata: null,
    };
  }
}
