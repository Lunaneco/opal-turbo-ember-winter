import { createFileRoute } from "@tanstack/react-router";
import { Kagami } from "@/components/kagami";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Kagami />;
}
