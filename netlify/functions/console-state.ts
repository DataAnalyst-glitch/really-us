import { consoleStateRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, consoleStateRoute);

export const config = { path: "/v1/console/state" };
