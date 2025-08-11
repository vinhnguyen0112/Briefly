const { object, string, array, number, boolean } = require("yup");

const createChatSchema = object({
  title: string().strict().trim().required(),
  page_url: string().strict().trim().required(),
});

const updateChatSchema = object({
  title: string().strict().trim(),
});

const createMessageSchema = object({
  role: string().strict().trim().required(),
  content: string().strict().trim().required(),
  model: string().strict().trim().nullable(),
});

const createFeedbackSchema = object({
  stars: number()
    .required("Stars rating is required")
    .integer("Stars must be an integer between 1 and 5")
    .min(1, "Stars must be at least 1")
    .max(5, "Stars cannot be more than 5"),
  comment: string().strict().trim().nullable(),
  message_id: number().strict().required(),
});

const createImageCaptionSchema = object({
  sources: array()
    .of(string().strict().trim().required())
    .required()
    .min(1, "At least one source is required"),
  context: string()
    .strict()
    .trim()
    .required("Missing or invalid content context")
    .min(1, "Missing or invalid content context"),
});

const queryMessagesSchema = object({
  role: string().oneOf(["user", "assistant", "system"]).required(),
  content: string().trim().required("Message content is required"),
});

const querySchema = object({
  messages: array()
    .of(queryMessagesSchema)
    .min(1, "At least one message is required")
    .required("Messages are required"),

  metadata: object({
    page_url: string()
      .trim()
      .url("Invalid page URL")
      .required("Page URL is required"),

    max_tokens: number()
      .integer("Max tokens must be an integer")
      .positive("Max tokens must be positive")
      .max(4096, "Max tokens exceeds model limit")
      .required("max_tokens is required"),

    language: string()
      .strict()
      .oneOf(["en", "vi"])
      .required("language must be specified"),

    event: string().trim().default("ask"),
  }).required("metadata is required"),
});

const suggestedQuestionSchema = object({
  pageContent: object({
    title: string().strict().trim().nullable(),
    url: string().strict().trim().nullable(),
    content: string().strict().trim().required("Page content is required"),
    pdfContent: string().strict().trim().nullable(),
  }).required("pageContent is required"),

  language: string()
    .strict()
    .oneOf(["en", "vi"], "Language must be either 'en' or 'vi'")
    .default("en"),
});

const createPageSchema = object({
  page_url: string().strict().trim().required(),
  title: string().strict().trim().default("Untitled Page"),
  page_content: string().strict().trim().required(),
  pdf_content: string().strict().trim().nullable(),
});

const updatePageSchema = object({
  title: string().strict().trim().nullable(),
  page_content: string().strict().trim().nullable(),
  pdf_content: string().strict().trim().nullable(),
});

const createPageSummarySchema = object({
  page_url: string().strict().trim().required(),
  language: string().strict().trim().oneOf(["en", "vi"]).required(),
  summary: string().strict().trim().required(),
});

const createNoteSchema = object({
  page_url: string().strict().trim().required(),
  note: string()
    .strict()
    .trim()
    .required()
    .min(1, "Note content cannot be empty"),
});

const updateNoteSchema = object({
  note: string()
    .strict()
    .trim()
    .required()
    .min(1, "Note content cannot be empty"),
});

module.exports = {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
  createFeedbackSchema,
  createImageCaptionSchema,
  querySchema,
  suggestedQuestionSchema,
  createPageSchema,
  updatePageSchema,
  createPageSummarySchema,
  createNoteSchema,
  updateNoteSchema,
};
