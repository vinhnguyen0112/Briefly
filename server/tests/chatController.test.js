const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./jestVariables");
const Chat = require("../models/chat");
const authHeader = `Bearer auth:${jestVariables.sessionId}`;

const chatId = "test_chat_1";
const chatTitle = "Example Webpage";
const chatUrl = "https://www.example.com/home";
describe("POST /chats", () => {
  it("Should create a new chat if all parameters are correctly provided", async () => {
    await supertest(app)
      .post("/api/chats")
      .set("Authorization", authHeader)
      .send({
        id: chatId,
        title: chatTitle,
        page_url: chatUrl,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });
});

describe("GET /chats", () => {
  it("Should get all chats for provided page", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 0 })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("chats");
        expect(response.body.data).toHaveProperty("hasMore");
      });
  });
});

afterAll(async () => {
  await Chat.delete(chatId);
  console.log("Mock chats deleted");
});
