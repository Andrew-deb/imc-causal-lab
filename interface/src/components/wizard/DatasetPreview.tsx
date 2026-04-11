import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface DatasetPreviewProps {
  files: File[];
}

interface ParsedDataset {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

const MAX_PREVIEW_ROWS = 10;

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
  );
  return { headers, rows };
}

function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = (data[0] as string[]).map((h) => String(h ?? ""));
  const rows = data.slice(1).map((row) => (row as string[]).map((c) => String(c ?? "")));
  return { headers, rows };
}

export default function DatasetPreview({ files }: DatasetPreviewProps) {
  const [datasets, setDatasets] = useState<ParsedDataset[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      const parsed: ParsedDataset[] = [];
      for (const file of files) {
        if (file.name.endsWith(".csv")) {
          const text = await file.text();
          const { headers, rows } = parseCSV(text);
          parsed.push({
            name: file.name,
            headers,
            rows: rows.slice(0, MAX_PREVIEW_ROWS),
            totalRows: rows.length,
          });
        } else {
          const buffer = await file.arrayBuffer();
          const { headers, rows } = parseExcel(buffer);
          parsed.push({
            name: file.name,
            headers,
            rows: rows.slice(0, MAX_PREVIEW_ROWS),
            totalRows: rows.length,
          });
        }
      }
      setDatasets(parsed);
    };
    loadFiles();
  }, [files]);

  if (datasets.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Dataset Preview</CardTitle>
          <Badge variant="secondary" className="text-xs">{datasets.length} file{datasets.length > 1 ? "s" : ""}</Badge>
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
              <TabsContent key={ds.name} value={ds.name}>
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
                        {ds.rows.map((row, ri) => (
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
                  <p className="text-sm text-muted-foreground py-4 text-center">{ds.headers[0]}</p>
                )}
                {ds.totalRows > MAX_PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Showing {MAX_PREVIEW_ROWS} of {ds.totalRows.toLocaleString()} rows
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
