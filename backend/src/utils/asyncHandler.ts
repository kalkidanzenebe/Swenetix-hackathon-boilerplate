import { Response, NextFunction, RequestHandler } from "express";
import { AuthedRequest } from "../types";

type Handler = (req: AuthedRequest, res: Response, next: NextFunction) =>  Promise<void>;
export const asyncHandler =(handler: Handler) : RequestHandler => 
    (req, res, next) => {
        handler(req as AuthedRequest, res, next).catch(next);
    };