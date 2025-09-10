const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const app = require("../app");
const { ERROR_CODES } = require("../errors");
const { v4: uuidv4 } = require("uuid");
const { redisHelper } = require("../helpers/redisHelper");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;
const pageUrl = "https://www.example.com/";
let sampleChatId;
let sampleMessageId;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

// Insert a sample message to test
beforeAll(async () => {
  // Create a test page first
  await supertest(app)
    .post("/api/pages")
    .set("Authorization", authHeader)
    .send({
      title: "Test Page",
      page_url: pageUrl,
      page_content: "Sample page content",
    })
    .expect(200);

  await supertest(app)
    .post("/api/chats")
    .set("Authorization", authHeader)
    .send({
      title: "My Page",
      page_url: pageUrl,
    })
    .expect(200)
    .then((response) => {
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("affectedRows", 1);
      expect(response.body.data).toHaveProperty("chat");
      expect(response.body.data.chat).toHaveProperty("id");
      sampleChatId = response.body.data.chat.id;
    });

  await supertest(app)
    .post(`/api/chats/${sampleChatId}/messages`)
    .set("Authorization", authHeader)
    .send({
      role: "assistant",
      content: "This is a test assistant response",
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
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
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
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
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

  it("Should fail if message doesn't exists", async () => {
    await supertest(app)
      .post("/api/feedback")
      .set("Authorization", authHeader)
      .send({
        stars: 4,
        comment: "Example comment",
        message_id: -1,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
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
});
