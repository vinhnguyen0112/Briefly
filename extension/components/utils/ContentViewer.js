// structured & readable
function formatExtractedContent(pageContent) {
  if (!pageContent) {
    return {
      success: false,
      error: "No content available",
    };
  }

  // a structured format of the content
  const structured = {
    metadata: {
      title: pageContent.title || "No title",
      url: pageContent.url || "No URL",
      timestamp: pageContent.timestamp || new Date().toISOString(),
    },
    hasSelection: !!pageContent.selection,
    selection: pageContent.selection || "",
    content: {
      summary: summarizeContent(pageContent.content),
      full: pageContent.content || "",
    },
    structuredData: processStructuredData(pageContent.structuredData),
    captions: pageContent.captions || [],
  };

  return {
    success: true,
    data: structured,
  };
}

//summarize by key sections
function summarizeContent(content) {
  if (!content) return { sections: [] };

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const sections = [];
  let currentSection = null;

  for (const paragraph of paragraphs) {
    // short lines that don't end with punctuation as potential headings
    if (paragraph.length < 100 && !paragraph.match(/[.!?:]$/)) {
      currentSection = {
        heading: paragraph.trim(),
        content: [],
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.content.push(paragraph.trim());
    } else {
      // If no section has been created yet, create one with no heading
      currentSection = {
        heading: null,
        content: [paragraph.trim()],
      };
      sections.push(currentSection);
    }
  }

  return {
    sections: sections,
    wordCount: countWords(content),
    characterCount: content.length,
  };
}
//process structured data for better display
function processStructuredData(structuredData) {
  if (!structuredData) return null;

  const processed = {
    hasJsonLd: !!structuredData.jsonLd,
    jsonLd: structuredData.jsonLd || [],
    tables: formatTables(structuredData.tables || []),
    apiDocumentation: structuredData.apiDocumentation || [],
  };

  return processed;
}

//format table data for better display
function formatTables(tables) {
  return tables.map((table) => {
    //  structured table format
    const formattedTable = {
      headers: table.headers || [],
      rows: table.rows || [],
      columnCount: table.headers
        ? table.headers.length
        : table.rows && table.rows.length > 0
        ? table.rows[0].length
        : 0,
    };

    // fuck them columns fr
    if (formattedTable.rows.length > 0) {
      formattedTable.columnTypes = detectColumnTypes(formattedTable);
    }

    return formattedTable;
  });
}

// detect column types for table data
function detectColumnTypes(table) {
  if (!table.rows || table.rows.length === 0) return [];

  const columnCount = table.columnCount;
  const types = [];

  for (let i = 0; i < columnCount; i++) {
    const sampleSize = Math.min(5, table.rows.length);
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    for (let j = 0; j < sampleSize; j++) {
      if (table.rows[j] && table.rows[j][i]) {
        const value = table.rows[j][i].trim();

        // Check for numeric type
        if (/^-?\d+(\.\d+)?$/.test(value)) {
          numericCount++;
        }
        // Check for date type
        else if (
          /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value) ||
          /\d{1,2}:\d{2}/.test(value) ||
          /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(value)
        ) {
          dateCount++;
        }
        // Check for boolean type
        else if (/^(true|false|yes|no|y|n)$/i.test(value)) {
          booleanCount++;
        }
      }
    }

    //  predominant type
    if (
      numericCount >= dateCount &&
      numericCount >= booleanCount &&
      numericCount > sampleSize / 2
    ) {
      types.push("numeric");
    } else if (
      dateCount >= numericCount &&
      dateCount >= booleanCount &&
      dateCount > sampleSize / 2
    ) {
      types.push("date");
    } else if (
      booleanCount >= numericCount &&
      booleanCount >= dateCount &&
      booleanCount > sampleSize / 2
    ) {
      types.push("boolean");
    } else {
      types.push("text");
    }
  }

  return types;
}

// count words in the given text
function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

// generate HTML for displaying the structured content
function generateContentViewerHTML(structured) {
  if (!structured || !structured.success) {
    return `<div class="content-viewer-error">
      <p>Unable to display content: ${structured?.error || "Unknown error"}</p>
    </div>`;
  }

  const data = structured.data;

  let html = `
    <div class="content-viewer">
      <div class="content-viewer-header">
        <h3>${escapeHtml(data.metadata.title)}</h3>
        <div class="content-viewer-meta">
          <div><strong>URL:</strong> <a href="${
            data.metadata.url
          }" target="_blank">${escapeHtml(data.metadata.url)}</a></div>
          <div><strong>Extracted:</strong> ${new Date(
            data.metadata.timestamp
          ).toLocaleString()}</div>
          <div><strong>Words:</strong> ${
            data.content.summary.wordCount
          } | <strong>Characters:</strong> ${
    data.content.summary.characterCount
  }</div>
        </div>
      </div>
  `;

  // Add user selection if available
  if (data.hasSelection) {
    html += `
      <div class="content-viewer-selection">
        <h4>Selected Text</h4>
        <div class="content-viewer-selection-text">${escapeHtml(
          data.selection
        )}</div>
      </div>
    `;
  }

  // Add content sections
  html += `<div class="content-viewer-sections">`;
  if (data.content.summary.sections.length > 0) {
    data.content.summary.sections.forEach((section) => {
      html += `
        <div class="content-viewer-section">
          ${section.heading ? `<h4>${escapeHtml(section.heading)}</h4>` : ""}
          ${section.content.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        </div>
      `;
    });
  } else {
    html += `<div class="content-viewer-no-sections">No content sections detected.</div>`;
  }
  html += `</div>`;

  if (data.captions && data.captions.length > 0) {
    html += `
      <div class="content-viewer-captions">
        <h4>Image Captions (${data.captions.length})</h4>
        <ul>
          ${data.captions
            .map(
              (c, i) =>
                `<li><strong>Caption ${i + 1}:</strong> ${escapeHtml(c)}</li>`
            )
            .join("")}
        </ul>
      </div>`;
  }
  // Add structured data if available
  if (data.structuredData) {
    html += `<div class="content-viewer-structured-data">
      <h4>Structured Data</h4>`;

    // Add tables
    if (data.structuredData.tables && data.structuredData.tables.length > 0) {
      html += `<div class="content-viewer-tables">
        <h5>Tables (${data.structuredData.tables.length})</h5>`;

      data.structuredData.tables.forEach((table, index) => {
        html += `<div class="content-viewer-table">
          <div class="table-title">Table ${index + 1}</div>
          <table>
            ${
              table.headers.length > 0
                ? `<thead>
              <tr>
                ${table.headers
                  .map((header) => `<th>${escapeHtml(header)}</th>`)
                  .join("")}
              </tr>
            </thead>`
                : ""
            }
            <tbody>
              ${table.rows
                .map(
                  (row) => `
                <tr>
                  ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
      });

      html += `</div>`;
    }

    // Add JSON-LD
    if (data.structuredData.hasJsonLd) {
      html += `<div class="content-viewer-jsonld">
        <h5>JSON-LD Data</h5>
        <div class="jsonld-summary">
          <p>${data.structuredData.jsonLd.length} JSON-LD objects found</p>
          <button class="toggle-json-button" data-target="jsonld-details">View JSON</button>
        </div>
        <div class="jsonld-details" style="display: none;">
          <pre>${escapeHtml(
            JSON.stringify(data.structuredData.jsonLd, null, 2)
          )}</pre>
        </div>
      </div>`;
    }

    // API documentation
    if (
      data.structuredData.apiDocumentation &&
      data.structuredData.apiDocumentation.length > 0
    ) {
      html += `<div class="content-viewer-api">
        <h5>API Documentation</h5>
        <div class="api-endpoints">
          ${data.structuredData.apiDocumentation
            .map(
              (api) => `
            <div class="api-endpoint ${api.type}">
              <div class="api-type">${escapeHtml(api.type)}</div>
              <div class="api-content">${escapeHtml(api.content)}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>`;
    }

    html += `</div>`;
  }

  // raw view toggle
  html += `
    <div class="content-viewer-raw">
      <button class="toggle-raw-button" data-target="raw-content">View Raw Content</button>
      <div class="raw-content" style="display: none;">
        <pre>${escapeHtml(data.content.full)}</pre>
      </div>
    </div>
  `;

  html += `</div>`;

  return html;
}

// escape HTML special characters
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// attach event handlers to the content viewer
function attachContentViewerEvents(container) {
  // toggle buttons
  container
    .querySelectorAll(".toggle-json-button, .toggle-raw-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-target");
        const targetElement = container.querySelector(`.${targetId}`);

        if (targetElement) {
          const isVisible = targetElement.style.display !== "none";
          targetElement.style.display = isVisible ? "none" : "block";
          button.textContent = isVisible
            ? button.textContent.replace("Hide", "View")
            : button.textContent.replace("View", "Hide");
        }
      });
    });
}

// Export the functions
window.ContentViewer = {
  formatExtractedContent,
  generateContentViewerHTML,
  attachContentViewerEvents,
};
