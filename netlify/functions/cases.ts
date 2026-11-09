import { casesRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, casesRoute);

export const config = { path: "/v1/cases" };
