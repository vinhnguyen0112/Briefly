const supertest = require("supertest");
const app = require("..");

supertest();

describe("POST /chats", () => {
  it("Should create a new chat if all parameters are provided", async () => {});
});

describe("GET /chats", () => {
  it("Should get all chats for provided page", async () => {
    const sessionId = "2ca22b05-d22a-4903-9b31-dcb0933aaa86";

    const request = await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 0 })
      .set("Authorization", `Bearer auth:${sessionId}`)
      .expect(200);
  });
});
