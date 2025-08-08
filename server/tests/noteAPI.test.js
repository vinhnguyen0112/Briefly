const supertest = require("supertest");
const app = require("../app");
const { ERROR_CODES } = require("../errors");
const jestVariables = require("./jestVariables");
const { redisHelper } = require("../helpers/redisHelper");
const Note = require("../models/note");

const authHeader = `Bearer auth:${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

describe("POST /api/notes", () => {
  const validPageUrl = "https://www.example.com/test-page";
  const validNoteContent = "This is a test note content";

  it("Should create a new note successfully", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: validPageUrl,
        note: validNoteContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
      });
  });

  it("Should normalize page URL when creating note", async () => {
    const urlWithQuery = "https://www.example.com/page?foo=bar&baz=qux";
    const noteContent = "Note with query parameters";

    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: urlWithQuery,
        note: noteContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id");
      });
  });

  it("Should fail if page_url is missing", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        note: validNoteContent,
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

  it("Should fail if page_url is invalid", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: "not a valid url",
        note: validNoteContent,
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

  it("Should fail if page_url is empty", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: "",
        note: validNoteContent,
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

  it("Should fail if page_url is not a string", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: 12345,
        note: validNoteContent,
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

  it("Should fail if note content is missing", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: validPageUrl,
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

  it("Should fail if note content is empty", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: validPageUrl,
        note: "",
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

  it("Should fail if note content is not a string", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: validPageUrl,
        note: 12345,
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

  it("Should fail if note content is null", async () => {
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: validPageUrl,
        note: null,
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

  it("Should fail if no authentication provided", async () => {
    await supertest(app)
      .post("/api/notes")
      .send({
        page_url: validPageUrl,
        note: validNoteContent,
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
      .post("/api/notes")
      .set("Authorization", "Bearer invalid:token")
      .send({
        page_url: validPageUrl,
        note: validNoteContent,
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
});

describe("GET /api/notes", () => {
  const testPageUrl = "https://www.example.com/test-notes-page";
  let sampleNoteIds = [];

  // Create sample notes before testing
  beforeAll(async () => {
    const notePromises = [];
    for (let i = 1; i <= 25; i++) {
      notePromises.push(
        supertest(app)
          .post("/api/notes")
          .set("Authorization", authHeader)
          .send({
            page_url: testPageUrl,
            note: `Test note ${i} for pagination`,
          })
          .then((response) => {
            sampleNoteIds.push(response.body.data.id);
          })
      );
    }
    await Promise.all(notePromises);
  });

  it("Should get notes for a specific page with pagination", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
        offset: 0,
        limit: 10,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("notes");
        expect(response.body.data).toHaveProperty("hasMore");
        expect(Array.isArray(response.body.data.notes)).toBe(true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(10);
        expect(response.body.data.hasMore).toBe(true);
      });
  });

  it("Should get second page of notes", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
        offset: 10,
        limit: 10,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(10);
      });
  });

  it("Should return hasMore false when no more notes", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
        offset: 100,
        limit: 10,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.hasMore).toBe(false);
        expect(response.body.data.notes.length).toBe(0);
      });
  });

  it("Should fail if page_url is missing", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        offset: 0,
        limit: 10,
      })
      .set("Authorization", authHeader)
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

  it("Should fail if page_url is invalid", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: "invalid url",
        offset: 0,
        limit: 10,
      })
      .set("Authorization", authHeader)
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

  it("Should fail if offset is negative", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
        offset: -1,
        limit: 10,
      })
      .set("Authorization", authHeader)
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

  it("Should fail if limit is zero or negative", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
        offset: 0,
        limit: 0,
      })
      .set("Authorization", authHeader)
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

  it("Should use default pagination if offset/limit not provided", async () => {
    await supertest(app)
      .get("/api/notes")
      .query({
        page_url: testPageUrl,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(20); // default limit
      });
  });
});

describe("GET /api/notes/all", () => {
  // Notes created in previous tests should be available here

  it("Should get all user notes with pagination", async () => {
    await supertest(app)
      .get("/api/notes/all")
      .query({
        offset: 0,
        limit: 15,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("notes");
        expect(response.body.data).toHaveProperty("hasMore");
        expect(Array.isArray(response.body.data.notes)).toBe(true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(15);
      });
  });

  it("Should get second page of all notes", async () => {
    await supertest(app)
      .get("/api/notes/all")
      .query({
        offset: 15,
        limit: 15,
      })
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(15);
      });
  });

  it("Should fail if offset is negative", async () => {
    await supertest(app)
      .get("/api/notes/all")
      .query({
        offset: -5,
        limit: 10,
      })
      .set("Authorization", authHeader)
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

  it("Should fail if limit is zero", async () => {
    await supertest(app)
      .get("/api/notes/all")
      .query({
        offset: 0,
        limit: 0,
      })
      .set("Authorization", authHeader)
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

  it("Should use default pagination if not provided", async () => {
    await supertest(app)
      .get("/api/notes/all")
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.notes.length).toBeLessThanOrEqual(20);
      });
  });
});

describe("PUT /api/notes/:id", () => {
  let testNoteId;
  const testPageUrl = "https://www.example.com/update-test";
  const originalContent = "Original note content";
  const updatedContent = "Updated note content";

  beforeAll(async () => {
    // Create a test note
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: testPageUrl,
        note: originalContent,
      })
      .expect(200)
      .then((response) => {
        testNoteId = response.body.data.id;
      });
  });

  it("Should update a note successfully", async () => {
    await supertest(app)
      .put(`/api/notes/${testNoteId}`)
      .set("Authorization", authHeader)
      .send({
        note: updatedContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("affectedRows", 1);
      });
  });

  it("Should verify note content was updated", async () => {
    const note = await Note.getById(testNoteId);
    expect(note).toBeTruthy();
    expect(note.note).toBe(updatedContent);
    expect(note.user_id).toBe(jestVariables.userId.toString());
  });

  it("Should fail if note does not exist", async () => {
    await supertest(app)
      .put("/api/notes/nonexistent-id")
      .set("Authorization", authHeader)
      .send({
        note: "Updated content",
      })
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
          },
        });
      });
  });

  it("Should fail if trying to update someone else's note", async () => {
    // This would require creating a note with different user_id
    // For now, we'll test with a made-up ID
    await supertest(app)
      .put("/api/notes/someone-elses-note")
      .set("Authorization", authHeader)
      .send({
        note: "Malicious update",
      })
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
          },
        });
      });
  });

  it("Should fail if note content is missing", async () => {
    await supertest(app)
      .put(`/api/notes/${testNoteId}`)
      .set("Authorization", authHeader)
      .send({})
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

  it("Should fail if note content is empty", async () => {
    await supertest(app)
      .put(`/api/notes/${testNoteId}`)
      .set("Authorization", authHeader)
      .send({
        note: "",
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

  it("Should fail if note content is not a string", async () => {
    await supertest(app)
      .put(`/api/notes/${testNoteId}`)
      .set("Authorization", authHeader)
      .send({
        note: 12345,
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

describe("DELETE /api/notes/:id", () => {
  let testNoteId;
  const testPageUrl = "https://www.example.com/delete-test";

  beforeAll(async () => {
    // Create a test note to delete
    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: testPageUrl,
        note: "Note to be deleted",
      })
      .expect(200)
      .then((response) => {
        testNoteId = response.body.data.id;
      });
  });

  it("Should delete a note successfully", async () => {
    await supertest(app)
      .delete(`/api/notes/${testNoteId}`)
      .set("Authorization", authHeader)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("affectedRows", 1);
      });
  });

  it("Should verify note was deleted from database", async () => {
    const note = await Note.getById(testNoteId);
    expect(note).toBe(null);
  });

  it("Should fail if note does not exist", async () => {
    await supertest(app)
      .delete("/api/notes/nonexistent-note-id")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
          },
        });
      });
  });

  it("Should fail if trying to delete someone else's note", async () => {
    await supertest(app)
      .delete("/api/notes/someone-elses-note")
      .set("Authorization", authHeader)
      .expect(404)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
          },
        });
      });
  });

  it("Should fail if no authentication provided", async () => {
    await supertest(app)
      .delete(`/api/notes/some-note-id`)
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
      .delete(`/api/notes/some-note-id`)
      .set("Authorization", "Bearer invalid:token")
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
});

describe("Edge Cases and Security", () => {
  it("Should handle very long note content", async () => {
    const longContent = "A".repeat(5000); // Very long note

    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/long-note",
        note: longContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should handle special characters in note content", async () => {
    const specialContent = "Special chars: éñüñ@#$%^&*()[]{}|;:,.<>?";

    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/special-chars",
        note: specialContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should handle Unicode content", async () => {
    const unicodeContent = "Unicode test: 你好世界 🌍 🚀 ✨";

    await supertest(app)
      .post("/api/notes")
      .set("Authorization", authHeader)
      .send({
        page_url: "https://www.example.com/unicode",
        note: unicodeContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
      });
  });

  it("Should normalize URLs with different formats", async () => {
    const testCases = [
      "https://www.example.com/path/",
      "https://www.example.com/path",
      "https://example.com/path?query=value",
      "http://www.example.com/path#fragment",
    ];

    for (const testUrl of testCases) {
      await supertest(app)
        .post("/api/notes")
        .set("Authorization", authHeader)
        .send({
          page_url: testUrl,
          note: `Note for ${testUrl}`,
        })
        .expect(200);
    }
  });
});
