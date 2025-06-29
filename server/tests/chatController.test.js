const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./jestVariables");
const { ERROR_CODES } = require("../errors");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const invalidAuthHeader = `Bearer auth:${jestVariables.invalidSessionId}`;

describe("POST /chats", () => {
  const chatId = "test_chat_1";
  const chatTitle = "Example Chat 1";
  const pageUrl = "https://www.example_url_1.com/home";

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

  it("Should fail if not authenticated", async () => {
    await supertest(app)
      .post("/api/chats")
      .send({
        id: chatId,
        title: chatTitle,
        page_url: pageUrl,
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.UNAUTHORIZED },
        });
      });
  });
});

describe("GET /chats", () => {
  // TODO: Add a bunch of dummy chats first
  it("Should get all chats with pagination", async () => {
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
  const chatId = "test_chat_2";
  const chatTitle = "Example Chat 2";
  const pageUrl = "https://www.example_url_2.com/home";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle });
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

  // TODO: Should it fail or return null?
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
  const chatId = "test_chat_3";
  const chatTitle = "Example Chat 3";
  const pageUrl = "https://www.example_url_3.com/home";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle });
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
  const chatId = "test_chat_4";
  const chatTitle = "Example Chat 4";
  const pageUrl = "https://www.example_url_4.com/home";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle });
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

  it("Should fail if chat ID is missing in request's query", async () => {
    await supertest(app)
      .delete("/api/chats/")
      .set("Authorization", authHeader)
      .expect(404); // Route not found
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

// Route WIP
// describe("DELETE /chats (all user chats)", () => {
//   beforeAll(async () => {
//     const chats = [
//       {
//         id: "test_chat_5",
//         title: "Example Chat 5",
//         pageUrl: "http://www.example_url_5.com/",
//       },
//       {
//         id: "test_chat_6",
//         title: "Example Chat 6",
//         pageUrl: "http://www.example_url_6.com/",
//       },
//       {
//         id: "test_chat_7",
//         title: "Example Chat 7",
//         pageUrl: "http://www.example_url_7.com/",
//       },
//     ];

//     const createChatInDB = async (chat) => {
//       await supertest(app)
//         .post(`/api/chats/`)
//         .set("Authorization", authHeader)
//         .send({ id: chat.id, page_url: chat.pageUrl, title: chat.title });
//     };

//     const promises = chats.map((chat) => createChatInDB(chat));

//     await Promise.all(promises);
//   });

//   it("Should delete all user's chats", async () => {
//     await supertest(app)
//       .delete("/api/chats")
//       .set("Authorization", authHeader)
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//       });
//   });

//   it("Should fail if not authenticated", async () => {
//     await supertest(app)
//       .delete("/api/chats")
//       .expect(401)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.UNAUTHORIZED },
//         });
//       });
//   });
// });

describe("POST /chats/:chat_id/messages", () => {
  const chatId = "test_chat_8";
  const chatTitle = "Example Chat 8";
  const pageUrl = "https://www.example_url_8.com";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle });
  });

  it("Should add a message to a chat", async () => {
    await supertest(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", authHeader)
      .send({ role: "user", content: "Test message 1", model: "gpt-3.5" })
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
  const chatId = "test_chat_9";
  const chatTitle = "Example Chat 9";
  const pageUrl = "https://www.example_url_9.com";

  beforeAll(async () => {
    // Add a chat
    await supertest(app)
      .post(`/api/chats/`)
      .set("Authorization", authHeader)
      .send({ id: chatId, page_url: pageUrl, title: chatTitle });

    // Add messages to chat
    const messages = [
      {
        role: "user",
        content: "Test message 2",
        model: "gpt-3.5",
      },
      {
        role: "user",
        content: "Test message 3",
        model: "gpt-3.5",
      },
      {
        role: "user",
        content: "Test message 4",
        model: "gpt-3.5",
      },
    ];

    const addMessagesToChatInDB = async (chat) => {
      await supertest(app)
        .post(`/api/chats/${chatId}/messages`)
        .set("Authorization", authHeader)
        .send({ role: chat.role, content: chat.content, model: chat.model });
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
