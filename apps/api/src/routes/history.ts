import { Router } from "express";
import { listPublishedHistory } from "../services/historyRepository.js";

export const historyRouter = Router();

historyRouter.get("/", async (_request, response, next) => {
  try {
    const history = await listPublishedHistory();
    response.json({ history });
  } catch (error) {
    next(error);
  }
});
