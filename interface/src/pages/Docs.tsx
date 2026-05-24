import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Info,
  Database,
  Workflow,
  TrendingUp,
  Award,
  ScrollText,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Terminal,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Moon,
  Sun,
  Layers,
  BarChart,
  DollarSign,
  Compass,
  FileSpreadsheet,
} from "lucide-react";

interface SubItem {
  id: string;
  title: string;
  hash: string;
}

interface Group {
  label: string;
  items: {
    id: string;
    title: string;
    icon: React.ComponentType<any>;
    subItems?: SubItem[];
  }[];
}

export default function Docs() {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("intro");
  const [activeSection, setActiveSection] = useState("");

  const groups: Group[] = [
    {
      label: "Getting Started",
      items: [
        {
          id: "intro",
          title: "Introduction",
          icon: Compass,
          subItems: [
            { id: "what-is", title: "What is Causal Lab?", hash: "#what-is" },
            { id: "causal-loop", title: "The Causal Lab Loop", hash: "#causal-loop" },
            { id: "terminology", title: "Core Terminology", hash: "#terminology" },
          ],
        },
      ],
    },
    {
      label: "Data & Classification",
      items: [
        {
          id: "ingestion",
          title: "Data Ingestion Specs",
          icon: Database,
          subItems: [
            { id: "table-reqs", title: "Table Requirements", hash: "#table-reqs" },
            { id: "schemas", title: "Expected Schemas", hash: "#schemas" },
            { id: "id-matching", title: "Identifier Consistency", hash: "#id-matching" },
          ],
        },
        {
          id: "imc",
          title: "IMC Classification",
          icon: Layers,
          subItems: [
            { id: "why-imc", title: "Why Standardize?", hash: "#why-imc" },
            { id: "mapping-flow", title: "AI Mapping Workflow", hash: "#mapping-flow" },
            { id: "overrides", title: "Manual Override Guide", hash: "#overrides" },
          ],
        },
      ],
    },
    {
      label: "Causal Graph Studio",
      items: [
        {
          id: "discovery",
          title: "Causal Discovery",
          icon: Workflow,
          subItems: [
            { id: "what-dag", title: "DAG Foundations", hash: "#what-dag" },
            { id: "roles", title: "Variable Roles", hash: "#roles" },
            { id: "backdoor", title: "Backdoor Criterion", hash: "#backdoor" },
          ],
        },
      ],
    },
    {
      label: "Inference & Modeling",
      items: [
        {
          id: "estimators",
          title: "Causal Estimators",
          icon: TrendingUp,
          subItems: [
            { id: "doubly-robust", title: "Doubly Robust Learner", hash: "#doubly-robust" },
            { id: "causal-forest", title: "Causal Forest (CATE)", hash: "#causal-forest" },
            { id: "t-learner", title: "T-Learner & Baselines", hash: "#t-learner" },
          ],
        },
      ],
    },
    {
      label: "Actions & Evaluation",
      items: [
        {
          id: "evaluation",
          title: "Off-Policy Evaluation",
          icon: Award,
          subItems: [
            { id: "uplift-curves", title: "Uplift & Qini Curves", hash: "#uplift-curves" },
            { id: "segments", title: "Customer Segmentation", hash: "#segments" },
          ],
        },
        {
          id: "optimization",
          title: "Spend Optimization",
          icon: DollarSign,
          subItems: [
            { id: "ate-consensus", title: "Consensus ATE Weighting", hash: "#ate-consensus" },
            { id: "reallocation", title: "Reallocation Engine", hash: "#reallocation" },
          ],
        },
      ],
    },
    {
      label: "System Diagnostics",
      items: [
        {
          id: "diagnostics",
          title: "Logs & Diagnostics",
          icon: ScrollText,
          subItems: [
            { id: "smd", title: "Covariate Balance (SMD)", hash: "#smd" },
            { id: "queue-worker", title: "Queue & Job Execution", hash: "#queue-worker" },
            { id: "severity-levels", title: "System Logs", hash: "#severity-levels" },
          ],
        },
      ],
    },
  ];

  // Filter content based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    return groups
      .map((g) => {
        const filteredItems = g.items.filter(
          (item) =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.subItems?.some((sub) =>
              sub.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
        return { ...g, items: filteredItems };
      })
      .filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const activeGroupItem = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((item) => item.id === activeTab);
      if (found) return found;
    }
    return null;
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans antialiased text-foreground">
      {/* Standalone Docs Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">Causal Lab Docs</span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border">
            v1.2.0
          </span>
        </div>

        {/* Global Docs Search */}
        <div className="hidden md:flex relative w-80">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search guides, concepts, API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8.5 text-xs w-full bg-surface-sunken"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button variant="outline" size="sm" className="h-8 gap-1.5 shadow-none text-xs" asChild>
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Console
            </Link>
          </Button>
        </div>
      </header>

      {/* Docs Body Layout */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* Left Navigation Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 overflow-y-auto hidden sm:flex select-none">
          <nav className="p-4 space-y-5">
            {filteredGroups.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 block">
                  {g.label}
                </span>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = item.id === activeTab;
                    return (
                      <div key={item.id} className="space-y-0.5">
                        <button
                          onClick={() => {
                            setActiveTab(item.id);
                            setActiveSection("");
                          }}
                          className={`flex items-center gap-2 px-2 py-1.5 text-left rounded-md text-xs font-medium w-full transition-all ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-primary" : "text-muted-foreground/75"}`} />
                          <span className="truncate">{item.title}</span>
                        </button>

                        {/* Expandable Sub-items */}
                        {isSelected && item.subItems && (
                          <div className="pl-6 border-l border-primary/20 ml-3.5 py-0.5 space-y-1">
                            {item.subItems.map((sub) => (
                              <a
                                key={sub.id}
                                href={sub.hash}
                                onClick={() => setActiveSection(sub.id)}
                                className={`block py-1 text-[11px] font-medium transition-colors ${
                                  activeSection === sub.id
                                    ? "text-primary"
                                    : "text-muted-foreground/80 hover:text-foreground"
                                }`}
                              >
                                {sub.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content Reader Panel */}
        <main className="flex-1 overflow-y-auto bg-background/50 relative">
          <div className="max-w-3xl mx-auto py-8 px-4 sm:px-8 space-y-12 pb-24">
            
            {/* ── Chapter: Introduction ────────────────────────────────────── */}
            {activeTab === "intro" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Getting Started <ChevronRight className="h-3 w-3" /> Introduction
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Getting Started with Causal Lab</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Causal Lab is a structural advertising attribution console. It replaces standard correlation statistics
                    with formal causal graphs and doubly robust learners to measure true incremental marketing performance.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="what-is" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">What is Causal Lab?</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Traditional attribution (e.g. Multi-Touch or Last-Click) counts sales occurrences following campaign exposure.
                    However, customers who see a search or social media ad are often organically inclined to buy anyway. This is called
                    <strong>selection bias (or confounding)</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Causal Lab resolves this bias by building structural models. It estimates the counterfactual: 
                    <em>What would exposed customers have spent if they had NOT seen the campaign?</em>
                  </p>
                </section>

                {/* Section 2 */}
                <section id="causal-loop" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">The Causal Lab Loop</h2>
                  <div className="bg-surface-sunken p-4 rounded-lg border font-mono text-[10px] leading-relaxed text-muted-foreground space-y-1">
                    <div className="text-foreground font-semibold mb-2">ASCII Workflow: Ingestion to Spend Allocation</div>
                    <div>   [Raw CSV Data] --(Wizard Ingestion)---+</div>
                    <div>                                          |</div>
                    <div>                                          v</div>
                    <div>   [Causal DAG Studio] &lt;--(IMC AI Classifier)--+</div>
                    <div>           |</div>
                    <div>           v</div>
                    <div>   [Double Robust Estimation] --(Off-policy Evaluation)---+</div>
                    <div>                                                           |</div>
                    <div>                                                           v</div>
                    <div>                                               [Targeting & Spent Optimization]</div>
                  </div>
                </section>

                {/* Section 3 */}
                <section id="terminology" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Core Terminology</h2>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                    <div className="border p-3.5 rounded-lg space-y-1 bg-card">
                      <dt className="font-semibold text-primary">Treatment ($T$)</dt>
                      <dd className="text-muted-foreground">Exposure status. A binary variable (1 = Exposed to campaign, 0 = Control group).</dd>
                    </div>
                    <div className="border p-3.5 rounded-lg space-y-1 bg-card">
                      <dt className="font-semibold text-primary">Outcome ($Y$)</dt>
                      <dd className="text-muted-foreground">The final response metric, e.g. transaction purchase amount or conversion.</dd>
                    </div>
                    <div className="border p-3.5 rounded-lg space-y-1 bg-card">
                      <dt className="font-semibold text-primary">Confounders ($X$)</dt>
                      <dd className="text-muted-foreground">Variables (like customer age, registration history) that impact both treatment exposure and sales purchase.</dd>
                    </div>
                    <div className="border p-3.5 rounded-lg space-y-1 bg-card">
                      <dt className="font-semibold text-primary">Average Treatment Effect (ATE)</dt>
                      <dd className="text-muted-foreground">The expected average lift across the customer base if everyone was treated vs control.</dd>
                    </div>
                  </dl>
                </section>

                <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 flex gap-3 text-xs text-muted-foreground">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold text-foreground">Next Step:</span> Proceed to **Data Ingestion Specs** to structure your CSV files.
                  </div>
                </div>
              </article>
            )}

            {/* ── Chapter: Data Ingestion Specs ────────────────────────────── */}
            {activeTab === "ingestion" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Data & Classification <ChevronRight className="h-3 w-3" /> Data Ingestion Specs
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Data Ingestion Specification</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Causal Lab aligns tables to isolate cohort effects. This section outlines the required file structures and links.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="table-reqs" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Table Requirements</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You must upload at least a Campaign exposures log and a Sales Transactions receipt log.
                    Customer Demographic and Supplementary datasets are optional.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="schemas" className="space-y-6">
                  <h2 className="text-lg font-semibold text-foreground">Expected Schemas</h2>
                  
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4 text-primary" /> Campaigns Table (CSV Template)
                    </h3>
                    <pre className="bg-surface-sunken p-3 rounded font-mono text-[11px] border overflow-x-auto">
{`campaign_id,customer_id,campaign_type,start_date,end_date
c_101,cust_901,google_search_brand,2026-03-01,2026-03-05
c_102,cust_902,facebook_social_ads,2026-03-02,2026-03-08`}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4 text-primary" /> Transactions Table (CSV Template)
                    </h3>
                    <pre className="bg-surface-sunken p-3 rounded font-mono text-[11px] border overflow-x-auto">
{`customer_id,transaction_date,transaction_amount
cust_901,2026-03-03,149.99
cust_902,2026-03-05,45.50`}
                    </pre>
                  </div>
                </section>

                {/* Section 3 */}
                <section id="id-matching" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Identifier Consistency</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The column `customer_id` must match exactly across all uploaded datasets. If campaigns are not logged at the individual customer level, leave `customer_id` blank in the campaign mapper.
                    The pipeline will automatically link exposures to sales outcomes based on temporal overlap during campaign active windows.
                  </p>
                </section>
              </article>
            )}

            {/* ── Chapter: IMC Classification ─────────────────────────────── */}
            {activeTab === "imc" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Data & Classification <ChevronRight className="h-3 w-3" /> IMC Classification
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">IMC Channel Classification</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    How Causal Lab organizes raw marketing campaigns into standardized categories.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="why-imc" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Why Standardize?</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Marketing divisions run hundreds of sub-campaigns. Without consolidation, sample sizes per estimator are too small, leading to high-variance estimates. Consolidating sub-campaigns into standard IMC groups (e.g. Paid Search, Email) maximizes statistical power.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="mapping-flow" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">AI Mapping Workflow</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When data is uploaded, Causal Lab queries an LLM to categorize raw campaign types based on semantic matching. For example, `spring_sale_adwords` is categorized as `Paid Search` and `newsletter_march_v2` is mapped to `Email Marketing`.
                  </p>
                </section>

                {/* Section 3 */}
                <section id="overrides" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Manual Override Guide</h2>
                  <div className="p-3.5 rounded-lg border border-warning/20 bg-warning-soft/10 flex gap-3 text-xs text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground">Important check:</span> The AI categorizer might misclassify internal codes. In Step 2 of the Causal wizard, inspect the mappings and override any incorrect links manually before continuing to Causal Discovery.
                    </div>
                  </div>
                </section>
              </article>
            )}

            {/* ── Chapter: Causal Discovery ───────────────────────────────── */}
            {activeTab === "discovery" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Causal Graph Studio <ChevronRight className="h-3 w-3" /> Causal Discovery
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">DAGs & Structural Discovery</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Learn how Directed Acyclic Graphs (DAGs) formulate identification assumptions and block confounding.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="what-dag" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">DAG Foundations</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A causal graph represents causal assumptions. A directed arrow $A \rightarrow B$ means $A$ causes $B$.
                    An acyclic graph has no feedback loops (no path starts and ends at the same node).
                  </p>
                </section>

                {/* Section 2 */}
                <section id="roles" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Variable Roles</h2>
                  <dl className="space-y-3 text-xs">
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold h-fit">Confounder</span>
                      <p className="text-muted-foreground">Common cause of exposure and outcome. <strong>Must be adjusted</strong>.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold h-fit">Mediator</span>
                      <p className="text-muted-foreground">Intermediate step. <strong>Do NOT adjust</strong> to measure total effect.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold h-fit">Collider</span>
                      <p className="text-muted-foreground">Common child. <strong>Do NOT adjust</strong> (induces selection bias).</p>
                    </div>
                  </dl>
                </section>

                {/* Section 3 */}
                <section id="backdoor" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Backdoor Criterion</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The platform scans the causal graph to find a set of variables $S$ that satisfies the backdoor criterion.
                    It blocks all backdoor paths (spurious correlations) without introducing collider bias, allowing identification of the causal treatment effect.
                  </p>
                </section>
              </article>
            )}

            {/* ── Chapter: Causal Estimators ─────────────────────────────── */}
            {activeTab === "estimators" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Inference & Modeling <ChevronRight className="h-3 w-3" /> Causal Estimators
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Causal Inference Estimators</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Detailing the mathematical frameworks for Double Robust and Causal Forest models.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="doubly-robust" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Doubly Robust Learner</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Double Robust Estimation (DR-Learner) fits two separate components:
                  </p>
                  <ol className="text-xs space-y-1 text-muted-foreground list-decimal pl-4">
                    <li>A propensity score model: predicts the likelihood of campaign exposure based on customer demographics.</li>
                    <li>An outcome model: predicts sales values based on exposure and demographics.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The estimator is **doubly robust** because it outputs unbiased treatment effect estimates if *at least one* model is specified correctly.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="causal-forest" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Causal Forest (CATE)</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Based on generalized random forests, the Causal Forest model partitions the covariate space. It identifies customer subgroups with different treatment responses.
                    This estimates the **Conditional Average Treatment Effect (CATE)**, which helps personalize target allocations.
                  </p>
                </section>

                {/* Section 3 */}
                <section id="t-learner" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">T-Learner & Baselines</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A T-Learner (Two-Learner) fits two independent regressions: one on control units and one on treated units.
                    The treatment effect is the difference between these predictions. Causal Lab matches these with linear regression baselines as tiebreakers.
                  </p>
                </section>
              </article>
            )}

            {/* ── Chapter: Off-Policy Evaluation ───────────────────────────── */}
            {activeTab === "evaluation" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Actions & Evaluation <ChevronRight className="h-3 w-3" /> Off-Policy Evaluation
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Off-Policy Evaluation System</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Validating your causal targeting model offline using historical logs.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="uplift-curves" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Uplift & Qini Curves</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uplift and Qini curves rank customers by their estimated CATE.
                    The curves plot cumulative purchase lift against population fractions.
                    A curve that stays above the baseline diagonal indicates that the causal model's targeting rules outperform random allocation.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="segments" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Customer Segmentation</h2>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="border p-2.5 rounded bg-success-soft/20 border-success/30">
                      <span className="font-semibold block text-success">Persuadables</span>
                      <span className="text-muted-foreground">Buy only if exposed. <strong>High Priority.</strong></span>
                    </div>
                    <div className="border p-2.5 rounded bg-danger-soft/20 border-danger/30">
                      <span className="font-semibold block text-destructive">Sleeping Dogs</span>
                      <span className="text-muted-foreground">Worse off if exposed. <strong>Do NOT contact.</strong></span>
                    </div>
                    <div className="border p-2.5 rounded bg-muted/40">
                      <span className="font-semibold block text-foreground">Sure Things</span>
                      <span className="text-muted-foreground">Buy anyway. Ads are wasted budget. <strong>Skip.</strong></span>
                    </div>
                    <div className="border p-2.5 rounded bg-muted/40">
                      <span className="font-semibold block text-foreground">Lost Causes</span>
                      <span className="text-muted-foreground">Never buy. Ads are wasted budget. <strong>Skip.</strong></span>
                    </div>
                  </div>
                </section>
              </article>
            )}

            {/* ── Chapter: Spend Optimization ─────────────────────────────── */}
            {activeTab === "optimization" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Actions & Evaluation <ChevronRight className="h-3 w-3" /> Spend Optimization
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketing Spend Optimization</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Allocating budgets dynamically across channels using consensus causal lift.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="ate-consensus" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Consensus ATE Weighting</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Multiple models run per channel. Causal Lab computes an **Agreement Score** based on overlap.
                    The **Consensus ATE** weights individual model estimates by their agreement. This ensures that spend is directed to channels with consistent and robust results.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="reallocation" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Reallocation Engine</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The platform recommends budget shifts: transferring budget from channels with weak or negative treatment effects (e.g. Sleeping Dogs) to channels with high Consensus ATE and a high percentage of Persuadables.
                  </p>
                </section>
              </article>
            )}

            {/* ── Chapter: Logs & Diagnostics ─────────────────────────────── */}
            {activeTab === "diagnostics" && (
              <article className="space-y-8 animate-fade-in-up">
                <div className="space-y-2 border-b pb-4">
                  <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                    System Diagnostics <ChevronRight className="h-3 w-3" /> Logs & Diagnostics
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Diagnostics & Job Logging</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Review worker queue metrics, event severities, and cohort sample size diagnostics.
                  </p>
                </div>

                {/* Section 1 */}
                <section id="smd" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Covariate Balance (SMD)</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To check if the treated and control cohorts are comparable, Causal Lab calculates the Standardized Mean Difference (SMD).
                    If SMD &gt; 0.1 for a covariate, it indicates significant cohort imbalance. You should adjust for this covariate in your DAG to correct for confounding.
                  </p>
                </section>

                {/* Section 2 */}
                <section id="queue-worker" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Queue & Job Execution</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pipeline jobs run sequentially in a background worker queue.
                    If a worker is restarted or cancelled, Causal Lab reconciles the job's elapsed times and updates completed or interrupted step states immediately.
                  </p>
                </section>

                {/* Section 3 */}
                <section id="severity-levels" className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">System Logs</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Backend execution prints structured atomic logs with details:
                  </p>
                  <pre className="bg-surface-sunken p-3 rounded font-mono text-[10px] border overflow-x-auto">
{`2026-05-23 10:04:57,223 - INFO - Starting Models loop: 0/12 runs
2026-05-23 10:04:58,410 - INFO - Progress: 1/12 tasks completed (8.3%) | search -> dr_learner [OK]
2026-05-23 10:04:59,101 - INFO - Progress: 2/12 tasks completed (16.7%) | search -> causal_forest [OK]`}
                  </pre>
                </section>
              </article>
            )}

          </div>
        </main>

        {/* Right Outline / Table of Contents (Desktop only) */}
        <aside className="w-56 border-l border-border bg-card p-4 hidden lg:flex flex-col shrink-0 overflow-y-auto select-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 px-1.5">
            On This Page
          </span>
          <div className="space-y-2">
            {activeGroupItem?.subItems?.map((sub) => (
              <a
                key={sub.id}
                href={sub.hash}
                onClick={() => setActiveSection(sub.id)}
                className={`flex items-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors hover:text-foreground ${
                  activeSection === sub.id
                    ? "text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground/80"
                }`}
              >
                <ChevronRight className="h-3 w-3 opacity-60" />
                <span className="truncate">{sub.title}</span>
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
