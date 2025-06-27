const supertest = require("supertest");
const app = require("..");
const jestVariables = require("./setup-jest");

// describe("POST /chats", () => {
//   it("Should create a new chat if all parameters are provided", async () => {});
// });

describe("GET /chats", () => {
  it("Should get all chats for provided page", async () => {
    const request = await supertest(app)
      .get("/api/chats")
      .query({ limit: 20, offset: 0 })
      .set("Authorization", `Bearer auth:${jestVariables.sessionId}`)
      .expect(200);
  });
});
