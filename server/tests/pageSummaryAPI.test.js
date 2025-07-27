const supertest = require("supertest");
const app = require("../app");
const { ERROR_CODES } = require("../errors");
const jestVariables = require("./jestVariables");
const { redisHelper } = require("../helpers/redisHelper");
const PageSummary = require("../models/pageSummary");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

describe("POST /api/page-summaries", () => {
  const pageUrl = "https://www.example.com/page-to-test-summary";
  const pageContent = "Some example content";
  beforeAll(async () => {
    const response = await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: pageUrl,
        page_content: pageContent,
      })
      .expect(200);

    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("id");
    pageId = response.body.data.id;
  });
  it("Should create a new page summary", async () => {
    const summary = "This is a summary";
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: pageUrl,
        language: "en",
        summary,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
      });
  });

  it("Should fail if page_url is missing", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ language: "en", summary: "Summary" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_url is invalid", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ page_url: "not an url", language: "en", summary: "Summary" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_url is not a string", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ page_url: 123, language: "en", summary: "Summary" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_url is empty", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ page_url: "", language: "en", summary: "Summary" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if language is missing", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ page_url: "https://www.example.com", summary: "Summary" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if language is not 'en' or 'vi'", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com",
        language: "jp",
        summary: "Summary",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if language is null", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com",
        language: null,
        summary: "Summary",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if summary is missing", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({ page_url: "https://www.example.com", language: "en" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if summary is empty", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com",
        language: "en",
        summary: "",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if summary is not a string", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com",
        language: "en",
        summary: 123,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if summary is null", async () => {
    await supertest(app)
      .post("/api/page-summaries")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com",
        language: "en",
        summary: null,
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
