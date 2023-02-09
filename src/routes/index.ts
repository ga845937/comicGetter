import express, { Router } from "express";
import { indexController } from "../controllers/index";

class IndexRouter {
    router: Router;
    constructor() {
        this.router = express.Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get("/", indexController.main);
    }
}

export const indexRouter = new IndexRouter;
