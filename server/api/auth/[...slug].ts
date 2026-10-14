import { fromWebHandler } from "h3";
import { auth } from "../../../src/lib/auth/server";

export default fromWebHandler((request) => auth.handler(request));
