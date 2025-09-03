const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`app listening on port: ${port}`);
});

const serverRouter = require("./routes/server");
app.use("/server", serverRouter);
console.log("server router initialized");

const clientRouter = require("./routes/client");
app.use("/client", clientRouter);
console.log("client router initialized");
