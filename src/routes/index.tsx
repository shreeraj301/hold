import { createFileRoute } from "@tanstack/react-router";
import { HoldScreen } from "@/components/hold-screen";

export const Route = createFileRoute("/")({
  component: HoldScreen,
});
