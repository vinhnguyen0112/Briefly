require("dotenv").config();

const app = require("./app");
const { redisCluster } = require("./helpers/redisHelper");
const dbHelper = require("./helpers/dbHelper");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CocBot server running on port ${PORT}`);
});

redisCluster
  .connect()
  .then(() => {
    console.log("Redis connected");
  })
  .catch((err) => {
    console.error("Redis connection error:", err);
    process.exit(1);
  });

dbHelper.getConnection().then(() => {
  console.log("MariaDB connected");
});
