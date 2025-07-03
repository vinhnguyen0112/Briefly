const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const { ERROR_CODES } = require("../errors");
const app = require("../app");
const { redisHelper } = require("../helpers/redisHelper");
const { v4: uuiv4 } = require("uuid");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

describe("POST /chats", () => {
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com/";

  it("Should create a new chat if all parameters are correctly provided", async () => {
    await supertest(app)
      .post("/api/chats")
      .set("Authorization", authHeader)
      .send({
        id: chatId,
        title: chatTitle,
        page_url: pageUrl,
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

  it("Should fail if page's url is invalid", async () => {
    await supertest(app)
      .post("/api/chats")
      .set("Authorization", authHeader)
      .send({
        id: chatId,
        title: chatTitle,
        page_url: "invalid page url",
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
  // Bulk insert 30 chats for testing
  beforeAll(async () => {
    await supertest(app)
      .post("/api/test/bulk-insert-chats")
      .set("Authorization", authHeader)
      .send({})
      .expect(200);
  });

  it("Should get all chats of first page", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 0 })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("chats");
        expect(Array.isArray(response.body.data.chats)).toBe(true);
        expect(response.body.data.chats.length).toBeLessThanOrEqual(20);
        expect(response.body.data).toHaveProperty("hasMore");
        expect(response.body.data.hasMore).toBe(true);
      });
  });

  it("Should get all chats of second page", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 20 })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("chats");
        expect(Array.isArray(response.body.data.chats)).toBe(true);
        expect(response.body.data.chats.length).toBeLessThanOrEqual(20);
        expect(response.body.data).toHaveProperty("hasMore");
        expect(response.body.data.hasMore).toBe(false);
      });
  });

  it("Should success but return no chats for a non-exist page", async () => {
    await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 100 })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("chats");
        expect(Array.isArray(response.body.data.chats)).toBe(true);
        expect(response.body.data.chats.length).toEqual(0);
        expect(response.body.data).toHaveProperty("hasMore");
        expect(response.body.data.hasMore).toBe(false);
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
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com/";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle })
      .expect(200);
  });

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

describe("PUT /chats/:id", () => {
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle })
      .expect(200);
  });

  it("Should update a chat", async () => {
    await supertest(app)
      .put(`/api/chats/${chatId}`)
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toMatchObject({ affectedRows: 1 });
      });
  });

  it("Should fail if chat ID is missing in request's query", async () => {
    await supertest(app)
      .put("/api/chats/")
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(404); // Route not found
  });

  it("Should have no effect if chat not found", async () => {
    await supertest(app)
      .put("/api/chats/nonexistent_id")
      .set("Authorization", authHeader)
      .send({ title: "Updated Title" })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("affectedRows");
        expect(response.body.data.affectedRows).toEqual(0);
      });
  });
});

describe("DELETE /chats/:id", () => {
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle })
      .expect(200);
  });

  it("Should delete a chat", async () => {
    await supertest(app)
      .delete(`/api/chats/${chatId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: true,
          data: { affectedRows: 1 },
        });
      });
  });

  it("Should have no effect if chat not found", async () => {
    await supertest(app)
      .delete("/api/chats/nonexistent_id")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("affectedRows");
        expect(response.body.data.affectedRows).toEqual(0);
      });
  });
});

describe("DELETE /chats (all user chats)", () => {
  beforeAll(async () => {
    const createChatInDB = async (chat) => {
      await supertest(app)
        .post(`/api/chats/`)
        .set("Authorization", authHeader)
        .send({ id: chat.id, page_url: chat.pageUrl, title: chat.title })
        .expect(200);
    };

    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        createChatInDB({
          id: uuiv4(),
          title: "Example Chat",
          pageUrl: "https://www.example.com",
        })
      );
    }

    await Promise.all(promises);
  });

  it("Should sucesfully deleted all user's chats", async () => {
    await supertest(app)
      .delete("/api/chats")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("affectedRows");
        expect(response.body.data.affectedRows).toBeGreaterThan(0);
      });
  });
});

describe("POST /chats/:chat_id/messages", () => {
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com";

  beforeAll(async () => {
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle })
      .expect(200);
  });

  it("Should add an user message to a chat", async () => {
    await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user", content: "Test user message", model: null })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
      });
  });

  it("Should add an assistant message to a chat", async () => {
    await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({
        role: "assistant",
        content: "Test assistant message",
        model: "gpt-3.5",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
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
  const chatId = uuiv4();
  const chatTitle = "Example Chat";
  const pageUrl = "https://www.example.com";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle })
      .expect(200);

    // Add messages to chat
    const messages = [
      {
        role: "user",
        content: "Test user message",
        model: null,
      },
      {
        role: "assistant",
        content: "Test assistant message",
        model: "gpt-3.5",
      },
      {
        role: "user",
        content: "Test user message",
        model: undefined,
      },
    ];

    const addMessagesToChatInDB = async (chat) => {
      await supertest(app)
        .post(`/api/chats/${chatId}/messages`)
        .set("Authorization", authHeader)
        .send({ role: chat.role, content: chat.content, model: chat.model })
        .expect(200);
    };

    const promises = messages.map((msg) => addMessagesToChatInDB(msg));

    await Promise.all(promises);
  });

  it("Should get all messages for a chat", async () => {
    await supertest(app)
      .get(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("messages");
        expect(Array.isArray(response.body.data.messages)).toBe(true);
      });
  });

  it("Should fail if chat_id is missing", async () => {
    await supertest(app)
      .get("/api/chats//messages")
      .set("Authorization", authHeader)
      .expect(404); // Route not found
  });
});
