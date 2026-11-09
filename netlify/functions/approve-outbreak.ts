import { approveRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, approveRoute);

export const config = { path: "/v1/outbreaks/:id/approve" };
