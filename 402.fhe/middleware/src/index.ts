import express from "express";
import * as dotenv from "dotenv";
import demoRoutes from "./demoApi";

dotenv.config();

const app = express();
app.use(express.json());
app.use(demoRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`middleware listening on :${port}`);
});
