import { StartServer } from "@tanstack/react-start/server";
import { createRouter } from "./router";

export default function Start() {
  const router = createRouter();
  return <StartServer router={router} />;
}
