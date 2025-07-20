const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.listen(3000, () => {
  console.log("app listening on port 3000");
});

const serverRouter = require("./routes/server");
app.use("/server", serverRouter);

const clientRouter = require("./routes/client");
app.use("/client", clientRouter);
