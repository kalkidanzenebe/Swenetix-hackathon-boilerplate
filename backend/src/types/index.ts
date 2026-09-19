import { Request } from "express";
import { TokenPayload } from "../utils/token";

export interface AuthedRequest extends Request {
    user?: TokenPayload | any;
    userId?: string;
}