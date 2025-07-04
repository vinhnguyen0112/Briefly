const { object, string, array, number } = require("yup");
const createChatSchema = object({
  id: string().strict().required(),
  title: string().strict().required(),
  page_url: string().strict().required(),
});

const updateChatSchema = object({
  title: string().strict(),
  page_url: string().strict(),
});

const createMessageSchema = object({
  role: string().strict().required(),
  content: string().strict().required(),
  model: string().strict().nullable(),
});

const createFeedbackSchema = object({
  stars: number()
    .required("Stars rating is required")
    .integer("Stars must be an integer between 1 and 5")
    .min(1, "Stars must be at least 1")
    .max(5, "Stars cannot be more than 5"),
  comment: string().nullable(),
  message_id: number().strict().required(),
});

const createImageCaptionSchema = object({
  sources: array()
    .of(string().required())
    .required()
    .min(1, "At least one source is required"),
  context: string()
    .strict()
    .required("Missing or invalid content context")
    .trim()
    .min(1, "Missing or invalid content context"),
});

module.exports = {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
  createFeedbackSchema,
  createImageCaptionSchema,
};
