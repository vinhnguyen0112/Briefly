const { object, string } = require("yup");
const createChatSchema = object({
  id: string().required(),
  title: string().required(),
  page_url: string().required(),
});

const updateChatSchema = object({
  title: string(),
  page_url: string(),
});

const createMessageSchema = object({
  role: string().required(),
  content: string().required(),
  model: string().nullable(),
});

const createFeedbackSchema = object({
  stars: string()
    .required()
    .matches(/^[1-5]$/, "Stars must be a number between 1 and 5"),
  comment: string().nullable(),
  messageId: string().required(),
});

module.exports = {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
  createFeedbackSchema,
};
