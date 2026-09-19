import { Verify } from "crypto";
import { Response, NextFunction } from "express";

export const requireAuth = (
    req: {headers: {authorization: "hehe"}, user: "me"}, res: Response, next: NextFunction
) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const user = token ? VerifyToken(token):null
    if(!user){
        req.status(401)
    }
}