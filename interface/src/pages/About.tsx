import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import causalDagImage from "@/assets/causal-dag-reference.png";
import { PageHeader } from "@/components/console/PageHeader";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="About the Platform"
        description="Understanding the Causal Analytics Platform for IMC analysis."
        breadcrumbs={[{ label: "About" }]}
      />

      {/* Causal Inference */}
      <Card>
        <CardHeader><CardTitle className="text-base">Causal Inference</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Causal inference is the process of drawing conclusions about causal connections based on the conditions of the occurrence of an effect.
            Unlike correlation-based analytics, causal methods allow us to estimate the true impact of marketing interventions by controlling for
            confounding variables and selection bias. This platform uses state-of-the-art estimators from the PyWhy ecosystem including
            DoWhy and EconML to produce robust causal estimates.
          </p>
        </CardContent>
      </Card>

      {/* IMC Exposure Analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base">IMC Exposure Analysis</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Integrated Marketing Communication (IMC) is a strategic approach that combines multiple communication channels to deliver a
            consistent brand message. This platform automatically categorizes raw campaign types into IMC exposure categories — advertising,
            promotion, direct marketing, and public relations — using AI-powered classification, enabling cross-channel causal effect comparison.
          </p>
        </CardContent>
      </Card>

      {/* Causal Estimands & Metrics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Causal Estimands &amp; Metrics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The platform computes several causal estimands to quantify marketing effectiveness:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "ATE (Average Treatment Effect)",
                desc: "The average causal effect of the treatment (IMC exposure) on the outcome across the entire population. It answers: 'On average, how much does marketing exposure change the outcome?'",
              },
              {
                name: "ATT (Average Treatment Effect on the Treated)",
                desc: "The average causal effect specifically for those who received the treatment. It answers: 'For those who were exposed to marketing, what was the effect?'",
              },
              {
                name: "CATE (Conditional Average Treatment Effect)",
                desc: "The treatment effect conditioned on specific subgroups (e.g., age, region, income). Enables understanding of heterogeneous effects and targeted marketing strategies.",
              },
              {
                name: "Uplift Segmentation",
                desc: "Classifies customers into four actionable segments based on their predicted treatment response.",
              },
            ].map((item) => (
              <div key={item.name} className="border rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Uplift Segments</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Persuadables", desc: "Customers who respond positively to treatment — ideal targets for marketing spend.", color: "bg-chart-2/10 text-chart-2" },
                { name: "Sure Things", desc: "Customers who convert regardless of treatment — no incremental value from targeting.", color: "bg-primary/10 text-primary" },
                { name: "Sleeping Dogs", desc: "Customers who respond negatively to treatment — avoid targeting to prevent churn.", color: "bg-chart-3/10 text-chart-3" },
                { name: "Lost Causes", desc: "Customers who do not convert regardless — no response to treatment.", color: "bg-chart-5/10 text-chart-5" },
              ].map((seg) => (
                <div key={seg.name} className="border rounded-lg p-3 space-y-1">
                  <Badge variant="secondary" className={`text-xs ${seg.color}`}>{seg.name}</Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">{seg.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Channel Effectiveness Ranking</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Each IMC channel (advertising, promotion, direct marketing, public relations) is ranked by its estimated causal effect on the
              outcome variable. This ranking enables marketers to allocate budget to the highest-impact channels with statistical confidence.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Causal Discovery Layer */}
      <Card>
        <CardHeader><CardTitle className="text-base">Causal Discovery Layer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The causal discovery layer identifies the structural causal relationships between variables in your dataset. It uses
            the PyWhy framework to automate the construction and validation of causal models.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="border rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Variable Role Assignment</h4>
              <p className="text-xs leading-relaxed">
                Users specify the <strong className="text-foreground">treatment</strong> (e.g., IMC exposure category),
                the <strong className="text-foreground">outcome</strong> (e.g., purchase, conversion),
                and <strong className="text-foreground">confounders</strong> (variables affecting both treatment and outcome, such as age or income).
                Optionally, <strong className="text-foreground">mediators</strong> (variables on the causal pathway) and
                <strong className="text-foreground"> colliders</strong> (variables caused by both treatment and outcome) can be specified.
              </p>
            </div>
            <div className="border rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Backdoor Criterion Verification</h4>
              <p className="text-xs leading-relaxed">
                The system applies the backdoor criterion from do-calculus to verify that the selected confounders are sufficient
                to block all non-causal paths between treatment and outcome, ensuring unbiased causal effect estimation.
              </p>
            </div>
            <div className="border rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Automated DAG Construction</h4>
              <p className="text-xs leading-relaxed">
                A Directed Acyclic Graph (DAG) is automatically generated to represent the assumed causal structure.
                The DAG encodes expert knowledge and algorithmic discovery to visualize how variables influence each other.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Causal DAG Structure Reference */}
      <Card>
        <CardHeader><CardTitle className="text-base">Causal DAG Structure Reference</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-1/2 border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
              <img
                src={causalDagImage}
                alt="Causal DAG structure showing relationships between Exposure (W), Confounder, Mediator, Collider, and Outcome (Y)"
                className="max-w-full h-auto"
              />
            </div>
            <div className="w-full md:w-1/2 space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                This diagram illustrates the fundamental structure of a causal Directed Acyclic Graph (DAG) used in the platform's analysis. Each variable role determines how arrows connect in the graph:
              </p>
              <ul className="space-y-2 text-xs leading-relaxed list-disc pl-4">
                <li><strong className="text-foreground">Exposure (Treatment, W):</strong> The variable whose causal effect we want to estimate. Arrows flow outward from the treatment toward the outcome, mediators, and colliders.</li>
                <li><strong className="text-foreground">Outcome (Y):</strong> The target variable we are measuring. It receives arrows from treatment, confounders, and mediators.</li>
                <li><strong className="text-foreground">Confounder (Common Cause):</strong> A variable that causally influences both the treatment and the outcome. Arrows flow from the confounder to both, creating a backdoor path that must be controlled.</li>
                <li><strong className="text-foreground">Mediator:</strong> A variable on the causal pathway between treatment and outcome. The treatment causes the mediator, and the mediator causes the outcome (Treatment → Mediator → Outcome).</li>
                <li><strong className="text-foreground">Collider (Common Effect):</strong> A variable caused by both the treatment and the outcome. Arrows flow into the collider from both sides. Conditioning on a collider can introduce bias.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Causal Graph (DAG) Design */}
      <Card>
        <CardHeader><CardTitle className="text-base">Causal Graph (DAG) Design</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Directed Acyclic Graph (DAG) is the core visual representation of causal assumptions in the analysis.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Nodes:</strong> Each node represents a variable in the dataset (e.g., age, income, imc_category, purchase). Nodes are color-coded by their causal role — treatment, outcome, confounder, mediator, or collider.</p>
            <Separator />
            <p><strong className="text-foreground">Edges:</strong> Directed edges (arrows) represent assumed causal relationships. An arrow from A → B means "A causally influences B." The graph must be acyclic — no circular causal chains are allowed.</p>
            <Separator />
            <p><strong className="text-foreground">Interactivity:</strong> The DAG is rendered using React Flow, providing zoom, pan, and interactive exploration. Users can inspect the causal structure before proceeding to estimation.</p>
            <Separator />
            <p><strong className="text-foreground">Validation:</strong> The graph is validated against the backdoor criterion. If the selected confounders are insufficient, the system provides feedback and recommendations for additional variables to control.</p>
          </div>
        </CardContent>
      </Card>

      {/* System Methodology */}
      <Card>
        <CardHeader><CardTitle className="text-base">System Methodology</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">1. Data Collection:</strong> Upload marketing datasets with customer, campaign, and transaction data. Define join keys and relationships between datasets.</p>
            <Separator />
            <p><strong className="text-foreground">2. IMC Categorization:</strong> AI maps raw campaign types (e.g., "ads", "sms", "email") to standardized IMC categories (advertising, promotion, direct marketing, public relations).</p>
            <Separator />
            <p><strong className="text-foreground">3. Causal Identification:</strong> Specify treatment, outcome, and confounding variables to define the causal question.</p>
            <Separator />
            <p><strong className="text-foreground">4. Causal Discovery:</strong> Automated DAG construction and backdoor criterion verification using the PyWhy framework.</p>
            <Separator />
            <p><strong className="text-foreground">5. Estimation:</strong> Compute ATE, ATT, CATE, and uplift segmentation using multiple estimators (DoWhy + EconML). Results are presented in an interactive dashboard with channel rankings and subgroup analysis.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
