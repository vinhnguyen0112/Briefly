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

  it("Should handle very long page content", async () => {
    const longContent = "A".repeat(10000); // 10KB content
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/long-content",
        title: "Long Content Page",
        page_content: longContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id");
      });
  });

  it("Should fail without authentication", async () => {
    await supertest(app)
      .post("/api/pages")
      .send({
        page_url: "https://www.example.com/no-auth",
        title: "No Auth Page",
        page_content: "Content without auth",
      })
      .expect(401);
  });
});

describe("GET /api/pages/:page_id", () => {
  let testPageId;

  beforeAll(async () => {
    // Create a test page for GET tests
    const response = await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/get-test-page",
        title: "Get Test Page",
        page_content: "Content for GET testing",
      });
    testPageId = response.body.data.id;
  });

  it("Should get a page by ID from database", async () => {
    await supertest(app)
      .get(`/api/pages/${testPageId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.page).toHaveProperty("id", testPageId);
        expect(response.body.data.page).toHaveProperty(
          "title",
          "Get Test Page"
        );
        expect(response.body.data.page).toHaveProperty(
          "page_content",
          "Content for GET testing"
        );
        expect(response.body.data.page).toHaveProperty("page_url");
      });
  });

  it("Should return page not found for non-existent ID", async () => {
    const nonExistentId = "non-existent-page-id-12345";

    await supertest(app)
      .get(`/api/pages/${nonExistentId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.page).toBeNull();
      });
  });

  it("Should fail with empty page_id", async () => {
    await supertest(app)
      .get("/api/pages/")
      .set("Authorization", authHeader)
      .expect(404); // Should hit 404 route not found
  });

  it("Should handle page_id with special characters", async () => {
    const specialId = "page-id-with-special-chars-!@#$%";

    await supertest(app)
      .get(`/api/pages/${encodeURIComponent(specialId)}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.page).toBeNull();
      });
  });

  it("Should handle very long page_id", async () => {
    const longId = "a".repeat(1000);

    await supertest(app)
      .get(`/api/pages/${longId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.page).toBeNull();
      });
  });

  it("Should trim whitespace from page_id", async () => {
    // Create a page first
    const response = await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/trim-test",
        title: "Trim Test Page",
        page_content: "Content for trim testing",
      });

    const pageId = response.body.data.id;

    // Test with whitespace around the ID
    await supertest(app)
      .get(`/api/pages/  ${pageId}  `)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.page).toBeTruthy();
      });
  });
});

describe("PUT /api/pages (update by URL)", () => {
  let pageUrl, pageId;

  beforeAll(async () => {
    pageUrl = "https://www.example.com/update-test-page";
    // Create a page to update
    const response = await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: pageUrl,
        title: "Original Title",
        page_content: "Original content",
      });
    pageId = response.body.data.id;
  });

  it("Should update the title of an existing page", async () => {
    await supertest(app)
      .put(`/api/pages?page_url=${encodeURIComponent(pageUrl)}`)
      .set("Authorization", authHeader)
      .send({
        title: "Updated Title",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("affectedRows", 1);
      });

    const updatedPage = await Page.getById(pageId);
    expect(updatedPage.title).toBe("Updated Title");
  });

  it("Should update the page_content of an existing page", async () => {
    await supertest(app)
      .put(`/api/pages?page_url=${encodeURIComponent(pageUrl)}`)
      .set("Authorization", authHeader)
      .send({
        page_content: "Updated content",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("affectedRows", 1);
      });

    const updatedPage = await Page.getById(pageId);
    expect(updatedPage.page_content).toBe("Updated content");
  });

  it("Should update the pdf_content of an existing page", async () => {
    await supertest(app)
      .put(`/api/pages?page_url=${encodeURIComponent(pageUrl)}`)
      .set("Authorization", authHeader)
      .send({
        pdf_content: "PDF content here",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("affectedRows", 1);
      });

    const updatedPage = await Page.getById(pageId);
    expect(updatedPage.pdf_content).toBe("PDF content here");
  });

  it("Should return affectedRows 0 if nothing to update", async () => {
    await supertest(app)
      .put(`/api/pages?page_url=${encodeURIComponent(pageUrl)}`)
      .set("Authorization", authHeader)
      .send({})
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("affectedRows", 0);
        expect(response.body.message).toBe("Nothing to update");
      });
  });

  it("Should fail if page_url is missing", async () => {
    await supertest(app)
      .put("/api/pages")
      .set("Authorization", authHeader)
      .send({
        title: "Should Not Work",
      })
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
      .put("/api/pages?page_url=not a valid url")
      .set("Authorization", authHeader)
      .send({
        title: "Should Not Work",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail without authentication", async () => {
    await supertest(app)
      .put(`/api/pages?page_url=${encodeURIComponent(pageUrl)}`)
      .send({
        title: "No Auth Update",
      })
      .expect(401);
  });
});
