import { useState, useCallback } from "react";
import { useSession } from "@/contexts/SessionContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, X, FileSpreadsheet, Info, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileParser } from "@/hooks/useFileParser";
import DatasetPreview from "./DatasetPreview";

type DatasetRole = "campaign" | "transaction" | "customer" | "additional" | "";

interface DatasetRoleAssignment {
  fileName: string;
  role: DatasetRole;
}

interface ColumnMappingState {
  campaignType: string;
  campaignStartDate: string;
  campaignEndDate: string;
  campaignCustomerId: string;
  transactionCustomerId: string;
  transactionDate: string;
  transactionAmount: string;
  customerCustomerId: string;
  additionalLinkColumn: string;
}

const ROLE_OPTIONS: { value: DatasetRole; label: string; description: string }[] = [
  { value: "campaign", label: "Campaign Data", description: "Contains campaign types, start/end dates" },
  { value: "transaction", label: "Transaction Data", description: "Contains customer purchases and amounts" },
  { value: "customer", label: "Customer Data", description: "Demographics and customer attributes (optional)" },
  { value: "additional", label: "Additional Data", description: "Supplementary data with extra variables" },
];

const DATASET_GUIDE = `IMC Causal Platform — Dataset Structure Guide
=============================================

Upload your data as CSV files and assign roles in the platform.

CAMPAIGN DATA (required) — one row per campaign
-------------------------------------------------
Required: campaign_type, start_date, end_date
Optional: campaign_id, customer_id, budget, impressions, clicks, conversions

TRANSACTION DATA (required) — one row per purchase
----------------------------------------------------
Required: customer_id, transaction_date, transaction_amount (or price)
Optional: product_name, product_category, payment_method, discount_applied

CUSTOMER DATA (optional) — one row per customer
-------------------------------------------------
Required: customer_id
Recommended: age, gender, region/state, income_level, registration_date

ADDITIONAL DATA (optional) — supplementary datasets
-----------------------------------------------------
Required: a column that links to customer_id
Examples: interaction logs, browsing data, support tickets

NOTES:
- campaign_type values will be mapped to IMC categories using AI
- Campaigns link to transactions via date overlap (no direct key needed)
- Customer ID must be consistent across all tables that use it
`;

export default function StepDataCollection({ onNext }: { onNext: () => void }) {
  const { setSessionId, setCampaignTypes, setColumns } = useSession();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<DatasetRoleAssignment[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingState>({
    campaignType: "",
    campaignStartDate: "",
    campaignEndDate: "",
    campaignCustomerId: "",
    transactionCustomerId: "",
    transactionDate: "",
    transactionAmount: "",
    customerCustomerId: "",
    additionalLinkColumn: "",
  });
  const [loading, setLoading] = useState(false);

  const { parsedFiles } = useFileParser(files);

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    setRoleAssignments((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ fileName: f.name, role: "" as DatasetRole })),
    ]);
  }, []);

  const removeFile = (i: number) => {
    const removed = files[i]?.name;
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setRoleAssignments((r) => r.filter((_, idx) => idx !== i));
    // Clear any column mappings that referenced the removed file
    if (removed) {
      setColumnMapping((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated) as (keyof ColumnMappingState)[]) {
          if (updated[key].startsWith(removed + "::")) {
            updated[key] = "";
          }
        }
        return updated;
      });
    }
  };

  const updateRole = (i: number, role: DatasetRole) => {
    setRoleAssignments((prev) => prev.map((item, idx) => (idx === i ? { ...item, role } : item)));
  };

  const getColumnsForRole = (role: DatasetRole): { fileName: string; columns: string[] }[] => {
    const assigned = roleAssignments.filter((r) => r.role === role);
    return assigned.map((a) => ({
      fileName: a.fileName,
      columns: parsedFiles.find((f) => f.name === a.fileName)?.headers || [],
    }));
  };

  const hasRole = (role: DatasetRole) => roleAssignments.some((r) => r.role === role);

  const handleDownloadGuide = () => {
    const blob = new Blob([DATASET_GUIDE], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imc_dataset_guide.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rolesAssigned = roleAssignments.some((r) => r.role !== "");

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast({ title: "No files", description: "Please upload at least one dataset.", variant: "destructive" });
      return;
    }
    if (!hasRole("campaign")) {
      toast({ title: "Missing role", description: "Please assign at least one file as Campaign Data.", variant: "destructive" });
      return;
    }
    if (!hasRole("transaction")) {
      toast({ title: "Missing role", description: "Please assign at least one file as Transaction Data.", variant: "destructive" });
      return;
    }
    if (!columnMapping.campaignType) {
      toast({ title: "Missing mapping", description: "Please map the Campaign Type / Channel column.", variant: "destructive" });
      return;
    }
    if (!columnMapping.campaignStartDate) {
      toast({ title: "Missing mapping", description: "Please map the Campaign Start Date column.", variant: "destructive" });
      return;
    }
    if (!columnMapping.campaignEndDate) {
      toast({ title: "Missing mapping", description: "Please map the Campaign End Date column.", variant: "destructive" });
      return;
    }
    if (!columnMapping.transactionDate) {
      toast({ title: "Missing mapping", description: "Please map the Transaction Date column.", variant: "destructive" });
      return;
    }
    if (!columnMapping.transactionAmount) {
      toast({ title: "Missing mapping", description: "Please map the Transaction Amount / Price column.", variant: "destructive" });
      return;
    }
    if (!columnMapping.transactionCustomerId) {
      toast({ title: "Missing mapping", description: "Please map the Transaction Customer ID column.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();

      // Map files to their backend field names based on role assignments
      const roleToField: Record<string, string> = {
        campaign: "campaigns",
        transaction: "transactions",
        customer: "customers",
      };

      for (let i = 0; i < files.length; i++) {
        const role = roleAssignments[i]?.role;
        const fieldName = roleToField[role];
        if (fieldName) {
          formData.append(fieldName, files[i]);
        }
      }

      // Send column mapping and roles as JSON metadata
      formData.append("roles", JSON.stringify(roleAssignments));
      formData.append("column_mapping", JSON.stringify(columnMapping));

      const res = await api.uploadDataset(formData);
      setSessionId(res.session_id);
      setCampaignTypes(res.campaign_types ?? []);
      setColumns(res.customers_columns ?? []);
      toast({ title: "Dataset uploaded", description: `Session: ${res.session_id}` });
      onNext();
    } catch {
      toast({ title: "Upload failed", description: "Check your files and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderColumnSelect = (
    fieldKey: keyof ColumnMappingState,
    role: DatasetRole,
    required: boolean = true,
    noneOption?: string
  ) => {
    const datasets = getColumnsForRole(role);
    return (
      <Select
        value={columnMapping[fieldKey]}
        onValueChange={(v) => setColumnMapping((prev) => ({ ...prev, [fieldKey]: v }))}
      >
        <SelectTrigger className="text-sm h-9">
          <SelectValue placeholder="Select column..." />
        </SelectTrigger>
        <SelectContent>
          {noneOption && (
            <SelectItem value="__none__" className="text-sm text-muted-foreground italic">
              {noneOption}
            </SelectItem>
          )}
          {datasets.map((ds) => (
            <div key={ds.fileName}>
              {datasets.length > 1 && (
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                  {ds.fileName}
                </div>
              )}
              {ds.columns.map((col) => (
                <SelectItem key={`${ds.fileName}::${col}`} value={`${ds.fileName}::${col}`}>
                  {col}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dataset Upload</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Upload CSV or Excel files</p>
            <label className="cursor-pointer">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
              <Button variant="outline" size="sm" asChild>
                <span>Choose Files</span>
              </Button>
            </label>
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Downloadable Guide Banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
        <FileDown className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Not sure how to structure your data?</p>
          <p className="text-xs text-muted-foreground">Download our guide for the expected dataset format.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadGuide}>
          Download Guide
        </Button>
      </div>

      {/* Dataset Preview */}
      {files.length > 0 && <DatasetPreview files={files} />}

      {/* Dataset Roles */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dataset Roles</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Assign a role to each uploaded file. The platform uses these roles to automatically determine how to merge and link your data.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset Name</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleAssignments.map((assignment, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{assignment.fileName}</TableCell>
                    <TableCell>
                      <Select value={assignment.role} onValueChange={(v) => updateRole(i, v as DatasetRole)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex flex-col">
                                <span>{opt.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Campaign Data links to transactions via date overlap. Customer and Additional Data link via Customer ID.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Column Mapping */}
      {rolesAssigned && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mapping</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Map the key columns from each dataset to enable analysis.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign Data fields */}
            {hasRole("campaign") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Campaign Data
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({roleAssignments.filter((r) => r.role === "campaign").map((r) => r.fileName).join(", ")})
                  </span>
                </div>
                <div className="border-t border-border" />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Campaign Type / Channel <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Identifies the marketing channel (e.g., Email Marketing, TV Ads)</p>
                  {renderColumnSelect("campaignType", "campaign")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Campaign Start Date <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">When each campaign began</p>
                  {renderColumnSelect("campaignStartDate", "campaign")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Campaign End Date <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">When each campaign ended</p>
                  {renderColumnSelect("campaignEndDate", "campaign")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Customer ID</Label>
                  <p className="text-xs text-muted-foreground">Optional — if your campaign data tracks individual customers</p>
                  {renderColumnSelect("campaignCustomerId", "campaign", false, "None (use date-window linkage)")}
                  <p className="text-[11px] text-muted-foreground/70 italic">
                    Leave empty if campaigns don't track individual customer exposure — the platform will link via date overlap instead.
                  </p>
                </div>
              </div>
            )}

            {/* Transaction Data fields */}
            {hasRole("transaction") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Transaction Data
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({roleAssignments.filter((r) => r.role === "transaction").map((r) => r.fileName).join(", ")})
                  </span>
                </div>
                <div className="border-t border-border" />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Customer ID <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Unique customer identifier — links to Customer Data</p>
                  {renderColumnSelect("transactionCustomerId", "transaction")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Transaction Date <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Date of each purchase</p>
                  {renderColumnSelect("transactionDate", "transaction")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Transaction Amount <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Monetary value of each transaction</p>
                  {renderColumnSelect("transactionAmount", "transaction")}
                </div>
              </div>
            )}

            {/* Customer Data fields */}
            {hasRole("customer") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Customer Data
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({roleAssignments.filter((r) => r.role === "customer").map((r) => r.fileName).join(", ")})
                  </span>
                </div>
                <div className="border-t border-border" />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Customer ID <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Must match the Customer ID in Transaction Data</p>
                  {renderColumnSelect("customerCustomerId", "customer")}
                </div>
              </div>
            )}

            {/* Additional Data fields */}
            {hasRole("additional") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Additional Data
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({roleAssignments.filter((r) => r.role === "additional").map((r) => r.fileName).join(", ")})
                  </span>
                </div>
                <div className="border-t border-border" />
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Link Column <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Column that links this data to customers (e.g., customer_id)</p>
                  {renderColumnSelect("additionalLinkColumn", "additional")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Uploading..." : "Upload & Continue"}
        </Button>
      </div>
    </div>
  );
}
