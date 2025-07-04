const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const app = require("../app");
const { ERROR_CODES } = require("../errors");
const { v4: uuidv4 } = require("uuid");
const message = require("../models/message");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const sampleChatId = uuidv4();
let sampleMessageId;

// Insert a sample message to test
beforeAll(async () => {
  await supertest(app)
    .post("/api/chats")
    .set("Authorization", authHeader)
    .send({
      id: sampleChatId,
      title: "Test Chat",
      page_url: "www.example.com",
    })
    .expect(200);

  await supertest(app)
    .post(`/api/chats/${sampleChatId}/messages`)
    .set("Authorization", authHeader)
    .send({
      role: "assistant",
      content: "This is a test message",
      model: "gpt-3.5",
    })
    .expect(200)
    .then((response) => {
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("id");
      sampleMessageId = response.body.data.id;
    });

  expect(sampleMessageId).toBeTruthy();
});

describe("POST /api/feedback", () => {
  it("Should successfully submit feedback with valid data", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 5,
        comment: "Great service!",
        message_id: sampleMessageId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("id");
        expect(response.body.id).toBeTruthy();
      });
  });

  it("Should successfully submit feedback with only stars", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4, message_id: sampleMessageId })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("id");
        expect(response.body.id).toBeTruthy();
      });
  });

  it("Should fail if no authentication provided", async () => {
    await supertest(app)
      .post("/api/feedback")
      .send({
        stars: 3,
        comment: "Anonymous feedback",
        message_id: sampleMessageId,
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
          },
        });
      });
  });

  it("Should fail if invalid authentication provided", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", "Bearer invalid:token")
      .send({
        stars: 3,
        comment: "Invalid auth feedback",
        message_id: sampleMessageId,
      })
      .expect(401)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
          },
        });
      });
  });

  it("Should fail if stars is missing", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ comment: "Comment without stars", message_id: sampleMessageId })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if message_id is missing", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4, comment: "Comment without stars" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if stars is less than 1", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 0,
        comment: "Invalid rating",
        message_id: sampleMessageId,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if stars is greater than 5", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 6,
        comment: "Invalid rating",
        message_id: sampleMessageId,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if stars is not a number", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: "five",
        comment: "Invalid rating type",
        message_id: sampleMessageId,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if stars is a decimal number", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 4.5,
        comment: "Decimal rating",
        message_id: sampleMessageId,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should accept boundary values 1 and 5 for stars", async () => {
    // Test minimum boundary
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 1,
        comment: "Minimum rating",
        message_id: sampleMessageId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });

    // Test maximum boundary
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 5,
        comment: "Maximum rating",
        message_id: sampleMessageId,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should accept empty comment", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 3, comment: "", message_id: sampleMessageId })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should accept long comments", async () => {
    const longComment = "A".repeat(1000);
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({ stars: 4, comment: longComment, message_id: sampleMessageId })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });
});
