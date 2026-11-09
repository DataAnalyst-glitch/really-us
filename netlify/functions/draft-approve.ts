import { draftApproveRoute, serve, type FunctionContext } from "../../api/src/http.js";

export default (req: Request, context: FunctionContext) => serve(req, context.params ?? {}, draftApproveRoute);

export const config = { path: "/v1/drafts/:id/approve" };
