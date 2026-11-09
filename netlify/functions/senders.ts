import { sendersRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, sendersRoute);

export const config = { path: "/v1/senders/:hash" };
