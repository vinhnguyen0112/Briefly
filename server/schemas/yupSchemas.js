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
  model: string().required(),
});

module.exports = { createChatSchema, updateChatSchema, createMessageSchema };
