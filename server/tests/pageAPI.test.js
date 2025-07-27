const supertest = require("supertest");
const app = require("../app");
const { ERROR_CODES } = require("../errors");
const Page = require("../models/page");
const jestVariables = require("./jestVariables");
const { redisHelper } = require("../helpers/redisHelper");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

describe("POST /api/pages", () => {
  it("Should create a new page", async () => {
    const pageUrl = "https://www.example.com/page";
    const page_content = "This is the full content of the page.";
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: pageUrl,
        title: "Test Page",
        page_content,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id");
      });
  });

  it("Should fail if page_url is missing", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({ title: "Test Page", page_content: "Sample content" })
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
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        title: "Test Page",
        page_content: "Content",
        page_url: "Not an url",
      })
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
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({ title: "Test Page", page_content: "Content", page_url: 123 })
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
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({ title: "Test Page", page_content: "Content", page_url: "" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_url is null", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({ title: "Test Page", page_content: "Content", page_url: null })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should insert default title if title is missing", async () => {
    let pageId;
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/new-page",
        page_content: "Some content",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();

        pageId = response.body.data.id;
      });

    const page = await Page.getById(pageId);
    expect(page.title).toBe("Untitled Page");
  });

  it("Should insert default title if title is empty string", async () => {
    let pageId;
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/new-page-2",
        page_content: "Some content",
        title: "",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();

        pageId = response.body.data.id;
      });

    const page = await Page.getById(pageId);
    expect(page.title).toBe("Untitled Page");
  });

  it("Should fail if title is not a string", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: 123,
        page_content: "Some content",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if title is null", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: null,
        page_content: "Some content",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_content is missing", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({ page_url: "https://www.example.com/page", title: "Test Page" })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_content is empty", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: "Test Page",
        page_content: "",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_content is not a string", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: "Test Page",
        page_content: 123,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if page_content is null", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: "Test Page",
        page_content: null,
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
