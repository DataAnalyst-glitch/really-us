import { verifyRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, verifyRoute);

export const config = { path: "/v1/verify" };
