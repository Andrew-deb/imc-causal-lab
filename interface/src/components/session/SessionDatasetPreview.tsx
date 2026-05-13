import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, ChevronDown, ChevronUp, Download, Eye, Loader2 } from "lucide-react";

interface SessionDatasetPreviewProps {
  sessionId: string;
  datasetMeta?: Record<string, any>;
}

const MAX_PREVIEW_ROWS = 10;

export default function SessionDatasetPreview({ sessionId, datasetMeta }: SessionDatasetPreviewProps) {
  const [expanded, setExpanded] = useState(true);
  const [previewRequested, setPreviewRequested] = useState(false);

  const { data: previewData, isLoading } = useQuery({
    queryKey: ["data-preview", sessionId],
    queryFn: () => api.getDataPreview(sessionId, MAX_PREVIEW_ROWS),
    enabled: previewRequested && !!sessionId,
  });

  if (!datasetMeta) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No dataset metadata available for this session.
        </CardContent>
      </Card>
    );
  }

  // Derive datasets list from datasetMeta
  const datasetNames = ["customers", "transactions", "campaigns"];
  const datasets = datasetNames.map((name) => {
    return {
      name: `${name}.csv`,
      baseName: name,
      headers: datasetMeta[`${name}_columns`] || [],
      totalRows: datasetMeta[`${name}_rows`] || 0,
      fileSize: "N/A (Cloud)", // We don't store file size in meta currently
    };
  }).filter((ds) => ds.headers.length > 0);

  if (datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No datasets found in session metadata.
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
        <div className="flex items-center gap-2">
          {!previewRequested && (
            <Button variant="outline" size="sm" onClick={() => setPreviewRequested(true)} className="h-8 gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Load Preview
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1 text-xs">{expanded ? "Collapse" : "Expand"}</span>
          </Button>
        </div>
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
            {datasets.map((ds) => {
              const previewInfo = previewData?.datasets[ds.baseName];
              
              return (
              <TabsContent key={ds.name} value={ds.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ds.totalRows.toLocaleString()} rows</span>
                    <span>·</span>
                    <span>{ds.headers.length} columns</span>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" disabled>
                    <Download className="h-3 w-3" /> Download Full
                  </Button>
                </div>

                {!previewRequested ? (
                  <div className="border rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 border-dashed">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                      Dataset preview is hidden to save bandwidth. Click to load the first few rows.
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => setPreviewRequested(true)}>
                      Load Data Preview
                    </Button>
                  </div>
                ) : isLoading ? (
                  <div className="border rounded-lg p-8 flex flex-col items-center justify-center bg-muted/10">
                    <Loader2 className="h-6 w-6 text-primary animate-spin mb-3" />
                    <p className="text-sm text-muted-foreground">Fetching data from secure storage...</p>
                  </div>
                ) : previewInfo && previewInfo.rows.length > 0 ? (
                  <div className="border rounded-lg overflow-auto max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewInfo.headers.map((h, i) => (
                            <TableHead key={i} className="text-xs font-semibold whitespace-nowrap">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewInfo.rows.map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((cell, ci) => (
                              <TableCell key={ci} className="text-xs font-mono whitespace-nowrap py-1.5">
                                {cell !== null && cell !== undefined ? String(cell) : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
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
                        <TableRow>
                          <TableCell colSpan={ds.headers.length} className="text-center py-8 text-muted-foreground">
                            No data rows could be loaded.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {previewRequested && !isLoading && ds.totalRows > MAX_PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing {Math.min(previewInfo?.rows.length || 0, MAX_PREVIEW_ROWS)} of {ds.totalRows.toLocaleString()} rows
                  </p>
                )}
              </TabsContent>
            )})}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
