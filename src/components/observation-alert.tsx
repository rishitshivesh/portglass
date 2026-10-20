import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ObservationAlert({
  title,
  children,
  destructive = false,
}: {
  title: string;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Alert variant={destructive ? "destructive" : "default"}>
      <ShieldCheck />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
