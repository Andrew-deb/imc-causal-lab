import React from "react";
import { Activity, ScrollText, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogsDiagnostics() {
  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ScrollText className="h-8 w-8 text-primary" /> Logs & Diagnostics
        </h1>
        <p className="text-muted-foreground">
          System logs, diagnostics, model agreement matrices, and quality assessments.
        </p>
      </div>

      <Card className="border-dashed border-2">
        <CardHeader className="text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-xl">Logs & Diagnostics coming in Part 2</CardTitle>
          <CardDescription className="max-w-md mx-auto mt-2">
            Currently implementing and verifying the Pipeline Monitor (/monitor) first. The logs, performance matrices, and system event feeds will be unlocked in the next stage.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
