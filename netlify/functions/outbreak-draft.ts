import { draftRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, draftRoute);

export const config = { path: "/v1/outbreaks/:id/draft" };
