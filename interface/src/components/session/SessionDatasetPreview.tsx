import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, ChevronDown, ChevronUp, Download } from "lucide-react";

export interface StoredDataset {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
  fileSize: string;
}

interface SessionDatasetPreviewProps {
  datasets: StoredDataset[];
}

const MAX_PREVIEW_ROWS = 10;

export default function SessionDatasetPreview({ datasets }: SessionDatasetPreviewProps) {
  const [expanded, setExpanded] = useState(true);

  if (datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No datasets available for this session.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Uploaded Datasets</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {datasets.length} file{datasets.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-1 text-xs">{expanded ? "Collapse" : "Expand"}</span>
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <Tabs defaultValue={datasets[0]?.name}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {datasets.map((ds) => (
                <TabsTrigger key={ds.name} value={ds.name} className="text-xs gap-1.5">
                  <FileSpreadsheet className="h-3 w-3" />
                  {ds.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {datasets.map((ds) => (
              <TabsContent key={ds.name} value={ds.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ds.totalRows.toLocaleString()} rows</span>
                    <span>·</span>
                    <span>{ds.headers.length} columns</span>
                    <span>·</span>
                    <span>{ds.fileSize}</span>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" disabled>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
                {ds.rows.length > 0 ? (
                  <div className="border rounded-lg overflow-auto max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {ds.headers.map((h, i) => (
                            <TableHead key={i} className="text-xs font-semibold whitespace-nowrap">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ds.rows.slice(0, MAX_PREVIEW_ROWS).map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((cell, ci) => (
                              <TableCell key={ci} className="text-xs font-mono whitespace-nowrap py-1.5">
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data to preview.</p>
                )}
                {ds.totalRows > MAX_PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing {Math.min(ds.rows.length, MAX_PREVIEW_ROWS)} of {ds.totalRows.toLocaleString()} rows
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
