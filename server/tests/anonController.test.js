const supertest = require("supertest");
const { ERROR_CODES } = require("../errors");
const app = require("../app");
const { redisCluster } = require("../helpers/redisHelper");

beforeAll(async () => {
  await redisCluster.connect();
});

afterAll(async () => {
  await redisCluster.quit();
});

describe("POST /anon", () => {
  it("Should sucessfully create an anonymous session if provided all parameter", async () => {
    await supertest(app)
      .post("/api/anon")
      .set("visitor", "test_visitor_id")
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("id");
        expect(response.body.data.id).toBeTruthy();
      });
  });

  it("Should fail if request doesn't have 'visisor' header", async () => {
    await supertest(app)
      .post("/api/anon")
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });

  it("Should fail if visitor id is empty", async () => {
    await supertest(app)
      .post("/api/anon")
      .set("visitor", "")
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: { code: ERROR_CODES.INVALID_INPUT },
        });
      });
  });
});
