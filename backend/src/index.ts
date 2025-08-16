import cors from "cors";
import express from "express";
import { apikey } from "./serverClient";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (_, res) => {
  res
    .status(200)
    .json({ message: "Ai chat app api is running ...", apikey: apikey });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is listening on http://localhost:${port}`);
});
