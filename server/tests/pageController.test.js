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
    const summary = "This is a summary";
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: pageUrl,
        title: "Test Page",
        summary,
        suggested_questions: ["Q1", "Q2"],
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
      .send({ title: "Test Page", summary: "Summary" })
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
      .send({ title: "Test Page", summary: "Summary", page_url: "Not an url" })
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
      .send({ title: "Test Page", summary: "Summary", page_url: 123 })
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
      .send({ title: "Test Page", summary: "Summary", page_url: "" })
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
      .send({ title: "Test Page", summary: "Summary", page_url: null })
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
        summary: "Summary",
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
        summary: "Summary",
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

  it("Should fail if title is null", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: null,
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

  it("Should fail if summary is not a string", async () => {
    await supertest(app)
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: "Test Page",
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
      .post("/api/pages")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/page",
        title: "Test Page",
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

// describe("PUT /api/pages/:id", () => {
//   let pageId;
//   const pageUrl = "https://www.example.com/page2";
//   const summary = "Initial summary";

//   beforeAll(async () => {
//     // Create a page to update
//     await supertest(app)
//       .post("/api/pages")
//       .set("Authorization", authHeader)
//       .send({
//         page_url: pageUrl,
//         title: "Initial Title",
//         summary,
//         suggested_questions: ["Q1"],
//       })
//       .expect(200)
//       .then((res) => {
//         expect(res.body).toHaveProperty("success", true);
//         expect(res.body).toHaveProperty("data");
//         expect(res.body.data).toHaveProperty("id");

//         pageId = res.body.data.id;
//       });
//   });

//   it("Should update a page's title and summary", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({
//         title: "Updated Title",
//         summary: "Updated summary",
//       })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body.data).toHaveProperty("affectedRows", 1);
//       });

//     const page = await Page.getById(pageId);
//     expect(page).toHaveProperty("title", "Updated Title");
//     expect(page).toHaveProperty("summary", "Updated summary");
//   });

//   it("Should have no effect if request body is empty", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({})
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });
//   });

//   it("Should fail if page id is missing", async () => {
//     await supertest(app)
//       .put("/api/pages/")
//       .set("Authorization", authHeader)
//       .send({ title: "Updated Title" })
//       .expect(404); // Route not found
//   });

//   it("Should have no effect if page not found", async () => {
//     await supertest(app)
//       .put("/api/pages/nonexistent_id")
//       .set("Authorization", authHeader)
//       .send({ title: "Updated Title" })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });
//   });

//   // Additional validation tests for update
//   it("Should fail if title is not a string", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ title: 123 })
//       .expect(400)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.INVALID_INPUT },
//         });
//       });
//   });

//   it("Should fail if title is null", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ title: null })
//       .expect(400)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.INVALID_INPUT },
//         });
//       });
//   });

//   it("Should have no effect if title is empty", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ title: "" })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body).toHaveProperty("data");
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });

//     const page = await Page.getById(pageId);
//     expect(page.title.trim()).not.toHaveLength(0);
//   });

//   it("Should fail if summary is not a string", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ summary: 123 })
//       .expect(400)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.INVALID_INPUT },
//         });
//       });
//   });

//   it("Should fail if summary is null", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ summary: null })
//       .expect(400)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.INVALID_INPUT },
//         });
//       });
//   });

//   it("Should have no effect if summary is empty", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ summary: "" })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body).toHaveProperty("data");
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });

//     const page = await Page.getById(pageId);
//     expect(page.summary.trim()).not.toHaveLength(0);
//   });

//   it("Should fail if suggested_questions is not an array", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ suggested_questions: 123 })
//       .expect(400)
//       .then((response) => {
//         expect(response.body).toMatchObject({
//           success: false,
//           error: { code: ERROR_CODES.INVALID_INPUT },
//         });
//       });
//   });

//   it("Should have no effect if suggested_questions is null", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ suggested_questions: null })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body).toHaveProperty("data");
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });
//   });

//   it("Should have no effect if suggested_questions is empty", async () => {
//     await supertest(app)
//       .put(`/api/pages/${pageId}`)
//       .set("Authorization", authHeader)
//       .send({ suggested_questions: [] })
//       .expect(200)
//       .then((response) => {
//         expect(response.body).toHaveProperty("success", true);
//         expect(response.body).toHaveProperty("data");
//         expect(response.body.data).toHaveProperty("affectedRows", 0);
//       });

//     const page = await Page.getById(pageId);
//     expect(page.suggested_questions).not.toHaveLength(0);
//   });
// });
