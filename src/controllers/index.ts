import { Request, Response } from "express";

class IndexController {
    async main(req: Request, res: Response) {
        try {
            res.render("index");
        }
        catch (err) {
            console.log(err);
        }
    }
}
export const indexController = new IndexController();
