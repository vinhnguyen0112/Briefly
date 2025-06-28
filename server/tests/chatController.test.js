const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./jestVariables");
const Chat = require("../models/chat");
const { ERROR_CODES } = require("../errors");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const invalidAuthHeader = `Bearer auth:${jestVariables.invalidSessionId}`;
const chatId = "test_chat_1";
const chatTitle = "Example Webpage";
const chatUrl = "https://www.example.com/home";

// TODO: Create some constants for each describe

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

  it("Should fail if missing required fields", async () => {
    await supertest(app)
      .post("/api/chats")
      .set("Authorization", authHeader)
      .send({ id: chatId })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if not authenticated", async () => {
    await supertest(app)
      .post("/api/chats")
      .send({
        id: chatId,
        title: chatTitle,
        page_url: chatUrl,
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should fail if page_url is invalid", async () => {
    await supertest(app)
      .post("/api/chats")
      .set("Authorization", authHeader)
      .send({
        id: chatId,
        title: chatTitle,
        page_url: "not-a-url",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
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

  it("Should fail if not authenticated", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 0 })
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });

  it("Should fail if limit is negative", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: -1, offset: 0 })
      .set("Authorization", authHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if limit is non-integer", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: "hello", offset: 0 })
      .set("Authorization", authHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if offset is negative", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: -1 })
      .set("Authorization", authHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if offset is non-integer", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: "hello" })
      .set("Authorization", authHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });
});

describe("GET /chats/:id", () => {
  it("Should get a chat by ID", async () => {
    await supertest(app)
      .get(`/api/chats/${chatId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id", chatId);
      });
  });

  it("Should fail if chat ID is missing", async () => {
    await supertest(app)
      .get("/api/chats/")
      .set("Authorization", authHeader)
      .expect(404); // Route not found, not controller error
  });

  it("Should fail if chat not found", async () => {
    await supertest(app)
      .get("/api/chats/nonexistent_id")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND },
        });
      });
  });
});

describe("PATCH /chats/:id", () => {
  it("Should update a chat", async () => {
    await supertest(app)
      .patch(`/api/chats/${chatId}`)
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if chat ID is missing", async () => {
    await supertest(app)
      .patch("/api/chats/")
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(404); // Route not found
  });

  it("Should fail if chat not found", async () => {
    await supertest(app)
      .patch("/api/chats/nonexistent_id")
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND },
        });
      });
  });
});

describe("DELETE /chats/:id", () => {
  it("Should delete a chat", async () => {
    await supertest(app)
      .delete(`/api/chats/${chatId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if chat ID is missing", async () => {
    await supertest(app)
      .delete("/api/chats/")
      .set("Authorization", authHeader)
      .expect(404); // Route not found
  });

  it("Should fail if chat not found", async () => {
    await supertest(app)
      .delete("/api/chats/nonexistent_id")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND },
        });
      });
  });
});

describe("DELETE /chats (all user chats)", () => {
  it("Should delete all user's chats", async () => {
    await supertest(app)
      .delete("/api/chats")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if not authenticated", async () => {
    await supertest(app)
      .delete("/api/chats")
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });
});

describe("POST /chats/:chat_id/messages", () => {
  it("Should add a message to a chat", async () => {
    await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user", content: "Hello!", model: "gpt-3.5" })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if missing required fields", async () => {
    await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });
});

describe("GET /chats/:chat_id/messages", () => {
  it("Should get all messages for a chat", async () => {
    await supertest(app)
      .get(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
  });

  it("Should fail if chat_id is missing", async () => {
    await supertest(app)
      .get("/api/chats//messages")
      .set("Authorization", authHeader)
      .expect(404); // Route not found
  });
});

describe("GET /messages/:message_id", () => {
  // TODO: Adjust this
  let messageId;
  beforeAll(async () => {
    // Add a message to get its ID
    const res = await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user", content: "Test message", model: "gpt-3.5" });
    // TODO: Adjust endpoint to actually return id
    messageId = res.body.data?.id || "test_message_id";
  });

  it("Should get a message by ID", async () => {
    await supertest(app)
      .get(`/api/messages/${messageId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id", messageId);
      });
  });

  it("Should fail if message_id is missing", async () => {
    await supertest(app)
      .get("/api/messages/")
      .set("Authorization", authHeader)
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if message not found", async () => {
    await supertest(app)
      .get("/api/messages/nonexistent_id")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND },
        });
      });
  });
});

describe("DELETE /messages/:message_id", () => {
  // TODO: Adjust this
  let messageId;
  beforeAll(async () => {
    // Add a message to get its ID
    const res = await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user", content: "To be deleted", model: "gpt-3.5" });
    messageId = res.body.data?.id || "test_message_id";
  });

  it("Should delete a message", async () => {
    await supertest(app)
      .delete(`/api/messages/${messageId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should fail if message_id is missing", async () => {
    await supertest(app)
      .delete("/api/messages/")
      .set("Authorization", authHeader)
      .expect(404); // Route not found
  });

  it("Should fail if message not found", async () => {
    await supertest(app)
      .delete("/api/messages/nonexistent_id")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.NOT_FOUND },
        });
      });
  });
});

afterAll(async () => {
  await Chat.delete(chatId);
  // Optionally clean up messages if needed
  console.log("Mock chats deleted");
});
