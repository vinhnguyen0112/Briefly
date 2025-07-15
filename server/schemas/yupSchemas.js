const { object, string, array, number, boolean } = require("yup");

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

const queryMessagesSchema = object({
  role: string().oneOf(["user", "assistant", "system"]).required(),
  content: string().trim().required("Message content is required"),
});

const querySchema = object({
  messages: array()
    .of(queryMessagesSchema)
    .min(1, "At least one message is required")
    .required("Messages are required"),

  max_tokens: number()
    .integer("Max tokens must be an integer")
    .positive("Max tokens must be positive")
    .max(4096, "Max tokens exceeds model limit")
    .required("max_tokens is required"),

  chat_meta: object({
    chat_id: string().trim().nullable(),

    page_url: string()
      .trim()
      .url("Invalid page URL")
      .required("Page URL is required"),

    title: string()
      .trim()
      .max(255, "Title must be at most 255 characters")
      .default("Untitled Page"),

    user_query: string().trim().required("User query is required"),

    should_create_chat: boolean().default(false),

    event: string().strict().default("ask"),
  }).required("chat_meta is required"),
});

module.exports = {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
  createFeedbackSchema,
  createImageCaptionSchema,
  querySchema,
};
