const { object, string, array, number } = require("yup");

const createChatSchema = object({
  id: string().strict().trim().required(),
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

const createPageSchema = object({
  page_url: string().strict().trim().required("Page URL is required"),

  title: string()
    .strict()
    .trim()
    .max(255, "Title must be at most 255 characters"),

  summary: string().strict().trim().required("Summary is required"),

  suggested_questions: array().of(string().strict().trim()).nullable(),
});

const updatePageSchema = object({
  title: string()
    .strict()
    .trim()
    .max(255, "Title must be at most 255 characters")
    .default("Untitled Page"),

  summary: string().strict().trim(),

  suggested_questions: array().of(string().strict().trim()).nullable(),
});

module.exports = {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
  createFeedbackSchema,
  createImageCaptionSchema,
  createPageSchema,
  updatePageSchema,
};
