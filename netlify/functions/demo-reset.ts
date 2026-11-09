import { resetRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, resetRoute);

export const config = { path: "/v1/demo/reset" };
