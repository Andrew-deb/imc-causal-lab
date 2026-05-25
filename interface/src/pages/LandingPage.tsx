import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-wrapper";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, PlayCircle, ShieldCheck, Zap, BarChart3, 
  Target, Cpu, Compass, Sparkles, CheckCircle2, 
  TrendingUp, MousePointer, BookOpen, RefreshCw, Info, HelpCircle,
  Database, Sun, Moon
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      navigate("/home");
    }
  }, [isSignedIn, navigate]);

  const handleLaunch = () => {
    try {
      sessionStorage.removeItem("guest_demo");
      sessionStorage.removeItem("sessionId");
    } catch (e) {}
    navigate("/home");
  };

  const handleExploreDemo = () => {
    try {
      sessionStorage.setItem("guest_demo", "true");
      sessionStorage.setItem("sessionId", "demo_session");
    } catch (e) {}
    navigate("/dashboard?session_id=demo_session&demo=true");
  };

  // ────────────────────────────────────────────────────────────────────────
  // 1. KIRO-STYLE INTERACTIVE PLATFORM SIMULATOR STATE
  // ────────────────────────────────────────────────────────────────────────
  const [simTab, setSimTab] = useState<"graph" | "compare" | "allocate">("graph");
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 110, y: 22 });
  const [isCursorClicking, setIsCursorClicking] = useState(false);
  const simulatorContainerRef = useRef<HTMLDivElement>(null);

  // Auto-play loop simulating mouse clicks
  useEffect(() => {
    if (!isAutoPlaying) return;

    const tabs: ("graph" | "compare" | "allocate")[] = ["graph", "compare", "allocate"];
    const coords = {
      graph: { x: 110, y: 22 },
      compare: { x: 230, y: 22 },
      allocate: { x: 360, y: 22 }
    };

    let clickTimeoutId: any;
    let changeTimeoutId: any;

    const mainTimeoutId = setTimeout(() => {
      const currentIndex = tabs.indexOf(simTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      const nextTab = tabs[nextIndex];

      // Move cursor to next tab coordinates
      setCursorPos(coords[nextTab]);

      // Trigger click and change active tab after cursor arrives (1.1s)
      clickTimeoutId = setTimeout(() => {
        setIsCursorClicking(true);
        changeTimeoutId = setTimeout(() => {
          setIsCursorClicking(false);
          setSimTab(nextTab);
        }, 150);
      }, 1100);

    }, 5000);

    return () => {
      clearTimeout(mainTimeoutId);
      if (clickTimeoutId) clearTimeout(clickTimeoutId);
      if (changeTimeoutId) clearTimeout(changeTimeoutId);
    };
  }, [simTab, isAutoPlaying]);

  // Handle manual clicks on simulator tabs
  const handleSimTabClick = (tab: "graph" | "compare" | "allocate", e: React.MouseEvent) => {
    setIsAutoPlaying(false);
    setSimTab(tab);
    
    // Position cursor exactly over clicked tab button
    if (simulatorContainerRef.current) {
      const rect = simulatorContainerRef.current.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // Simulated code/log stream for Causal Discovery tab
  const [simLogs, setSimLogs] = useState<string[]>([]);
  useEffect(() => {
    if (simTab !== "graph") {
      setSimLogs([]);
      return;
    }
    const logPool = [
      "INFO:     [Dataset] Loading 'marketing_attribution_core.csv'...",
      "INFO:     [Dataset] Loaded 45,210 customer rows, 12 channel variables.",
      "INFO:     [DAG Discovery] Initializing PC algorithm structure search...",
      "INFO:     [DAG Discovery] Evaluating independence tests (alpha=0.05)...",
      "INFO:     [DAG Discovery] Found causal parent: Ad_Spend -> Direct_Visits",
      "INFO:     [DAG Discovery] Found causal parent: Seasonality -> Ad_Spend",
      "INFO:     [DAG Discovery] Found causal parent: Seasonality -> Sales_Revenue",
      "INFO:     [DAG Discovery] Closed backdoor adjustment set: {Seasonality}",
      "INFO:     [DAG Discovery] DAG structure validation completed (Score=98.4%)."
    ];
    let currentLogs: string[] = [];
    setSimLogs([logPool[0]]);
    
    const interval = setInterval(() => {
      if (currentLogs.length < logPool.length) {
        currentLogs = logPool.slice(0, currentLogs.length + 1);
        setSimLogs(currentLogs);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [simTab]);

  // ────────────────────────────────────────────────────────────────────────
  // 2. PLAYABLE CAUSAL DAG SANDBOX STATE
  // ────────────────────────────────────────────────────────────────────────
  const [paths, setPaths] = useState({
    X_to_T: true,   // Seasonality -> Campaign
    X_to_Y: true,   // Seasonality -> Revenue
    T_to_M: true,   // Campaign -> Direct Visits (Mediator)
    M_to_Y: true,   // Direct Visits -> Revenue
    T_to_Y: true,   // Campaign -> Revenue (Direct)
  });
  const [adjustConfounder, setAdjustConfounder] = useState(false);
  const [adjustMediator, setAdjustMediator] = useState(false);

  // Compute sandbox stats based on active links and adjustments
  const hasConfounding = paths.X_to_T && paths.X_to_Y;
  const isConfounderControlled = adjustConfounder;
  const isMediatorBlocked = adjustMediator && paths.T_to_M && paths.M_to_Y;

  // Real causal effect parameters
  const baseDirectEffect = paths.T_to_Y ? 3.00 : 0.00;
  const baseIndirectEffect = (paths.T_to_M && paths.M_to_Y) ? 2.00 : 0.00;
  const trueEffect = baseDirectEffect + baseIndirectEffect;

  // Causal bias parameters
  const confoundingBias = (hasConfounding && !isConfounderControlled) ? 3.75 : 0.00;
  const overcontrollingBias = isMediatorBlocked ? -2.00 : 0.00;
  
  // Final calculated estimation
  const estimatedEffect = trueEffect + confoundingBias + overcontrollingBias;

  // Determine classification/state
  let sandboxStatus: "unbiased" | "confounded" | "overcontrolled" = "unbiased";
  if (hasConfounding && !isConfounderControlled) {
    sandboxStatus = "confounded";
  } else if (isMediatorBlocked) {
    sandboxStatus = "overcontrolled";
  }

  // Preset graph layouts
  const applyPreset = (preset: "standard" | "mediator-only" | "confounded-only" | "unbiased") => {
    if (preset === "standard") {
      setPaths({ X_to_T: true, X_to_Y: true, T_to_M: true, M_to_Y: true, T_to_Y: true });
      setAdjustConfounder(true);
      setAdjustMediator(false);
    } else if (preset === "mediator-only") {
      setPaths({ X_to_T: false, X_to_Y: false, T_to_M: true, M_to_Y: true, T_to_Y: true });
      setAdjustConfounder(false);
      setAdjustMediator(true);
    } else if (preset === "confounded-only") {
      setPaths({ X_to_T: true, X_to_Y: true, T_to_M: false, M_to_Y: false, T_to_Y: true });
      setAdjustConfounder(false);
      setAdjustMediator(false);
    } else if (preset === "unbiased") {
      setPaths({ X_to_T: true, X_to_Y: true, T_to_M: true, M_to_Y: true, T_to_Y: true });
      setAdjustConfounder(true);
      setAdjustMediator(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // 3. DOCUMENTATION PREVIEW STATE
  // ────────────────────────────────────────────────────────────────────────
  const [activeDocTab, setActiveDocTab] = useState<"foundations" | "doubleml" | "uplift">("foundations");
  const docContents = {
    foundations: {
      chapter: "Chapter 1. Causal Structural Models",
      title: "Directed Acyclic Graphs (DAGs) and Backdoor Paths",
      excerpt: "Causal structural models mathematically define dependencies between marketing actions (treatments) and performance metrics (outcomes). A causal graph is represented as a DAG G = (V, E) where directed paths map treatment variables to outcome nodes. Confounders (X) introduce spurious correlations that inflate traditional marketing mix metrics.",
      code: `# Structure validation using PyWhy DoWhy
model = CausalModel(
    data=df,
    treatment='Ad_Spend',
    outcome='Sales_Revenue',
    common_causes=['Seasonality', 'Competitor_Discount']
)
identified_estimand = model.identify_effect()`
    },
    doubleml: {
      chapter: "Chapter 3. de-biased machine learning",
      title: "Double Machine Learning (DML) via Orthogonalization",
      excerpt: "DML splits high-dimensional parameters into target treatment components and nuisance covariates. We first estimate nuisance variables (predicting Treatment from Confounders, and Outcome from Confounders) using machine learning algorithms. The residues are then residualized to retrieve unbiased orthogonal treatment estimations.",
      code: `# Execute Double ML estimation in IMC Lab
from doubleml import DoubleMLPLR
from sklearn.ensemble import RandomForestRegressor

dml_data = double_ml_data_from_dataframe(df)
dml_plr = DoubleMLPLR(
    dml_data,
    ml_g=RandomForestRegressor(n_estimators=100),
    ml_m=RandomForestRegressor(n_estimators=100)
)
dml_plr.fit()`
    },
    uplift: {
      chapter: "Chapter 5. Individual targeting theory",
      title: "Uplift Modeling and Policy Budget Optimization",
      excerpt: "Uplift models calculate individual conditional treatment effects (CATE) to categorize customer lists. Segment classifications target 'Persuadables' (positive uplift) while suppressing spend on 'Sure Things' (zero incrementality) and 'Sleeping Dogs' (negative response), maximizing programmatic budget allocation efficiency.",
      code: `# Calculate individual CATE segments
uplift_model = CausalForestRegressor(n_estimators=500)
uplift_model.fit(X_train, T_train, Y_train)
cate_scores = uplift_model.predict_cate(X_test)
# Classify users into targeting quadrants
targeting_policy = assign_quadrants(cate_scores)`
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#050608] text-slate-900 dark:text-[#e2e8f0] overflow-x-hidden font-sans transition-colors duration-300">
      {/* MongoDB style forest-green glow meshes */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-radial-gradient from-indigo-200/30 dark:from-indigo-950/20 via-indigo-100/10 dark:via-indigo-900/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-[-10%] w-[50%] h-[50%] rounded-full bg-radial-gradient from-indigo-200/20 dark:from-indigo-950/20 via-slate-100/5 dark:via-slate-900/5 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-radial-gradient from-indigo-200/15 dark:from-indigo-950/15 via-slate-100/5 dark:via-slate-900/5 to-transparent blur-[140px] pointer-events-none" />

      {/* Subtle grid backdrop */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(#6366f1 1px, transparent 1px)`,
          backgroundSize: "28px 28px"
        }}
      />

      {/* Glassmorphic Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-900/80 bg-white/80 dark:bg-[#050608]/75 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-[1300px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Compass className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-md font-bold tracking-tight font-outfit text-slate-900 dark:text-white bg-clip-text">
              IMC Causal Lab
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-slate-600 dark:text-slate-400">
            <a href="#simulator" className="hover:text-slate-900 dark:hover:text-white transition-colors">Interactive Tour</a>
            <a href="#sandbox" className="hover:text-slate-900 dark:hover:text-white transition-colors">DAG Sandbox</a>
            <a href="#docs-preview" className="hover:text-slate-900 dark:hover:text-white transition-colors">Core Concepts</a>
            <a href="/docs" target="_blank" className="hover:text-white transition-colors flex items-center gap-1">
              Documentation <ArrowRight className="h-3 w-3" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/50 h-9 w-9 rounded-md shrink-0"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/50 text-[13px] font-medium px-4 h-9"
              onClick={handleExploreDemo}
            >
              Explore Demo
            </Button>
            <Button 
              className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:brightness-110 active:scale-98 transition-all font-semibold text-[13px] px-5 h-9 rounded-md shadow-md shadow-indigo-500/15"
              onClick={handleLaunch}
            >
              Launch Console
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Area (MongoDB Atlas Style) */}
      <section className="relative z-10 max-w-[1300px] mx-auto px-6 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Heading & Value Prop */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> High-Fidelity Marketing Incrementality Engine
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900 dark:text-white font-outfit">
              Prove and optimize
              <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400">
                true marketing lift.
              </span>
            </h1>
            
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-[550px] leading-relaxed font-normal">
              Break free from biased attribution algorithms. IMC Causal Lab harnesses double machine learning and causal structural diagrams (DAGs) to isolate incremental sales effects and optimize spend quadrants.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-3">
              <Button 
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:brightness-110 active:scale-98 font-bold px-8 h-12 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group"
                onClick={handleLaunch}
              >
                Launch Console <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/20 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white h-12 px-6 flex items-center justify-center gap-2"
                onClick={handleExploreDemo}
              >
                <PlayCircle className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" /> Explore Demo sandbox
              </Button>
            </div>

            {/* Micro Stats Bar */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-900/80 max-w-[500px]">
              <div>
                <div className="text-2xl font-bold font-outfit text-slate-900 dark:text-white">4+</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Estimator Types</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-outfit text-slate-900 dark:text-white">100%</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Session Isolation</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-outfit text-slate-900 dark:text-white">Double ML</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">De-biased Inference</div>
              </div>
            </div>
          </div>

          {/* Right Column: Mini Promo Feature Graphic */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-[480px] aspect-video rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white dark:from-slate-950/80 to-slate-50 dark:to-slate-950/20 p-5 shadow-2xl overflow-hidden group">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900/80 pb-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Estimator: DR-Learner</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Estimated ATE (Sales Uplift)</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">+$4.82 / conversion</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-blue-400 h-full rounded-full w-[78%] animate-pulse" />
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-100 dark:bg-[#06080d] p-3 border border-slate-200 dark:border-slate-900 rounded-lg font-mono">
                  <p className="text-slate-700 dark:text-slate-400 font-semibold mb-1">Causal Forest Summary</p>
                  <p className="text-slate-600 dark:text-slate-500">&gt; p-value: 0.002 (Highly Significant)</p>
                  <p className="text-slate-600 dark:text-slate-500">&gt; 95% Confidence Interval: [3.91, 5.73]</p>
                  <p className="text-slate-600 dark:text-slate-500">&gt; Target Persuadables ratio: 18.2%</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────
          SECTION: KIRO-STYLE INTERACTIVE PLATFORM SIMULATOR
          ──────────────────────────────────────────────────────────────────────── */}
      <section id="simulator" className="border-t border-slate-200 dark:border-slate-900 bg-slate-100/60 dark:bg-[#06080d]/60 py-24 relative">
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="text-center max-w-[700px] mx-auto mb-14 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-outfit">
              Explore the Console in Action
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              Watch this interactive mock walk-through simulating how our modeling queue processes datasets, fits de-biased estimators, and constructs budget reallocation policies.
            </p>
          </div>

          {/* Simulator Window */}
          <div 
            ref={simulatorContainerRef}
            className="relative w-full max-w-[850px] mx-auto border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#090b11] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header / Tabs */}
            <div className="flex items-center justify-between bg-slate-100 dark:bg-[#06080c] border-b border-slate-200 dark:border-slate-900 px-6 py-3 select-none">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              </div>
              
              {/* Tab Selector Buttons */}
              <div className="flex items-center bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-slate-900 rounded-lg p-0.5 text-xs font-medium">
                <button 
                  onClick={(e) => handleSimTabClick("graph", e)}
                  className={`px-3 py-1.5 rounded-md transition-all ${simTab === "graph" ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  1. Causal Graph
                </button>
                <button 
                  onClick={(e) => handleSimTabClick("compare", e)}
                  className={`px-3 py-1.5 rounded-md transition-all ${simTab === "compare" ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  2. Estimator Benchmarks
                </button>
                <button 
                  onClick={(e) => handleSimTabClick("allocate", e)}
                  className={`px-3 py-1.5 rounded-md transition-all ${simTab === "allocate" ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  3. Budget Optimizer
                </button>
              </div>

              {/* Autoplay Status Indicator */}
              <button 
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="text-[10px] font-mono flex items-center gap-1.5 px-2 py-1 rounded bg-slate-200 dark:bg-slate-900 hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800"
              >
                <RefreshCw className={`h-3 w-3 ${isAutoPlaying ? "animate-spin text-indigo-500 dark:text-indigo-400" : ""}`} />
                {isAutoPlaying ? "AUTOPLAYING" : "USER CONTROL"}
              </button>
            </div>

            {/* Simulator Screen Content */}
            <div className="p-6 sm:p-8 min-h-[380px] flex flex-col justify-between">
              
              {/* Tab 1: Causal Graph Discovery */}
              {simTab === "graph" && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1">
                  {/* Visual Causal Graph */}
                  <div className="md:col-span-7 flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/40 rounded-xl min-h-[260px] relative">
                    <span className="absolute top-2 left-3 text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-wider">Causal Structure discovery (Causal Discovery)</span>
                    
                    <svg className="w-full h-[180px]" viewBox="0 0 350 180">
                      {/* Connection arrows */}
                      <path d="M 60,90 Q 130,50 200,90" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4,4" className="animate-[dash_6s_linear_infinite]" />
                      <path d="M 60,90 Q 175,140 290,90" fill="none" stroke="#6366f1" strokeWidth="2" />
                      <path d="M 200,90 Q 245,50 290,90" fill="none" stroke="#64748b" strokeWidth="1.5" />
                      
                      <polygon points="285,95 292,90 285,85" fill="#818cf8" />
                      <polygon points="195,95 202,90 195,85" fill="#10b981" />

                      {/* Nodes */}
                      <g>
                        <circle cx="60" cy="90" r="20" fill="#f8fafc" className="dark:fill-slate-900" stroke="#10b981" strokeWidth="2" />
                        <text x="60" y="93" textAnchor="middle" fill="#10b981" className="text-[8px] font-mono font-bold">SPEND</text>
                      </g>
                      <g>
                        <circle cx="200" cy="90" r="20" fill="#f8fafc" className="dark:fill-slate-900" stroke="#475569" strokeWidth="1.5" />
                        <text x="200" y="93" textAnchor="middle" fill="#94a3b8" className="text-[8px] font-mono">SEASON</text>
                      </g>
                      <g>
                        <circle cx="290" cy="90" r="20" fill="#f8fafc" className="dark:fill-slate-900" stroke="#6366f1" strokeWidth="2" />
                        <text x="290" y="93" textAnchor="middle" fill="#818cf8" className="text-[8px] font-mono font-bold">SALES</text>
                      </g>
                    </svg>
                    <div className="text-[10px] font-mono text-slate-500 border-t border-slate-200 dark:border-slate-900 pt-3 w-full text-center">
                      Identified adjustment set: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{"{Seasonality}"}</span>
                    </div>
                  </div>

                  {/* Terminal Log Console */}
                  <div className="md:col-span-5 bg-slate-100 dark:bg-black/85 rounded-xl p-4 border border-slate-300 dark:border-slate-900 font-mono text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed min-h-[260px] flex flex-col justify-between overflow-hidden">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-500 border-b border-slate-300 dark:border-slate-900 pb-1.5 mb-2">
                        <span>PIPELINE ACTIVITY</span>
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      </div>
                      <div className="max-h-[180px] overflow-y-auto space-y-1.5">
                        {simLogs.map((log, idx) => (
                          <div key={idx} className="truncate">
                            <span className="text-slate-500">&gt; </span>
                            {log.includes("completed") ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{log}</span>
                            ) : log.includes("closed") ? (
                              <span className="text-cyan-600 dark:text-cyan-400">{log}</span>
                            ) : (
                              <span>{log}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-600 border-t border-slate-900/60 pt-2 flex items-center justify-between">
                      <span>Causal Inference Engine</span>
                      <span>v1.2.0</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Model Comparison */}
              {simTab === "compare" && (
                <div className="space-y-6 flex-1 flex flex-col justify-center">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-100 dark:bg-[#0b0e17] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">T-Learner (OLS)</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">+$3.12 <span className="text-xs text-slate-500 font-normal">/ unit</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Uplift Qini AUC: <span className="font-bold text-slate-700 dark:text-slate-300">0.68</span></div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-[#0c1219] border border-slate-200 dark:border-indigo-900/50 rounded-xl p-4 space-y-2 relative overflow-hidden shadow-lg shadow-indigo-500/[0.02]">
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-indigo-400 uppercase font-semibold">Causal Forest (RF)</span>
                        <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 rounded font-bold">BEST</span>
                      </div>
                      <div className="text-xl font-bold text-indigo-400 font-mono">+$4.82 <span className="text-xs text-slate-500 font-normal">/ unit</span></div>
                      <div className="text-[10px] text-slate-400">Uplift Qini AUC: <span className="font-bold text-indigo-400">0.82</span></div>
                    </div>
                    
                    <div className="bg-slate-100 dark:bg-[#0b0e17] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">DR-Learner (Double ML)</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">+$4.75 <span className="text-xs text-slate-500 font-normal">/ unit</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Uplift Qini AUC: <span className="font-bold text-slate-700 dark:text-slate-300">0.79</span></div>
                    </div>
                  </div>

                  {/* Benchmark charts mock representation */}
                  <div className="bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900 p-4 rounded-xl space-y-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Estimated Uplift Curves (Treatment vs Control)</span>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-600 dark:text-slate-400">Causal Forest (Maximized targeting efficiency)</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">82% Uplift Lift</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full w-[82%] transition-all duration-1000" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-600 dark:text-slate-400">Double ML DR-Learner</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">79% Uplift Lift</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full w-[79%] transition-all duration-1000" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-600 dark:text-slate-400">Correlation Baseline (Standard Multi-Attribution)</span>
                          <span className="text-slate-500 font-bold">48% Uplift Lift</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-slate-400 dark:bg-slate-700 h-full rounded-full w-[48%] transition-all duration-1000" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Budget Optimizer */}
              {simTab === "allocate" && (
                <div className="space-y-6 flex-1 flex flex-col justify-center">
                  <div className="bg-indigo-50 dark:bg-[#0b131a] border border-indigo-200 dark:border-indigo-950 p-5 rounded-xl flex items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" /> Recommended Optimization Policy
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-[450px] leading-relaxed">
                        Reallocate <span className="text-slate-900 dark:text-white font-bold font-mono">$15,000</span> from low-incrementality Search Ads to High-Uplift Display segments.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono font-outfit">+18.4%</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">Projected ROI Gain</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 dark:border-slate-900 bg-slate-100 dark:bg-slate-950/40 p-4 rounded-xl space-y-3">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">Current Allocation ($25k budget)</span>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 font-mono">Search Campaigns</span>
                          <span className="text-slate-900 dark:text-white font-semibold">$18,000</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-400 dark:bg-slate-600 h-full w-[72%]" />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 font-mono">Display Campaigns</span>
                          <span className="text-slate-900 dark:text-white font-semibold">$7,000</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-400 dark:bg-slate-600 h-full w-[28%]" />
                        </div>
                      </div>
                    </div>

                    <div className="border border-indigo-200 dark:border-slate-900 bg-indigo-50/50 dark:bg-[#070b12]/50 p-4 rounded-xl space-y-3">
                      <span className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400/80 uppercase block">Optimized Allocation ($25k budget)</span>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-mono">Search Campaigns</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">$3,000</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-400 dark:bg-slate-700 h-full w-[12%]" />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-mono">Display Campaigns</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold font-mono">$22,000</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-blue-400 h-full w-[88%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom control feedback bar */}
              <div className="border-t border-slate-200 dark:border-slate-900/60 pt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Status: Simulated Console Active</span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-600">Click any tab button above to pause autoplay and interact manually.</span>
              </div>

            </div>

            {/* Simulated Mouse Cursor */}
            <div 
              className={`absolute pointer-events-none transition-all duration-1000 ease-out z-30`}
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`
              }}
            >
              <MousePointer className={`h-5 w-5 text-indigo-400 fill-indigo-400 shadow-md ${isCursorClicking ? "scale-75 text-indigo-300 fill-indigo-300" : ""}`} />
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────
          SECTION: PLAYABLE CAUSAL DAG SANDBOX
          ──────────────────────────────────────────────────────────────────────── */}
      <section id="sandbox" className="py-24 border-t border-slate-200 dark:border-slate-900 relative">
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="text-center max-w-[700px] mx-auto mb-14 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-outfit">
              Playable Causal DAG Sandbox
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              Attribution models often fall victim to confounding bias. Toggle variables and paths in the causal graph below to observe how spurious correlations distort true treatment effects in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Interactive Graph Box */}
            <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07090e] rounded-2xl p-5 flex flex-col justify-between min-h-[420px]">
              
              {/* Presets header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-900 pb-4 mb-4 select-none">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono">Graph Structure Canvas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
                  <button 
                    onClick={() => applyPreset("standard")}
                    className="text-[10px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Fully Connected
                  </button>
                  <button 
                    onClick={() => applyPreset("confounded-only")}
                    className="text-[10px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Confounded Only
                  </button>
                  <button 
                    onClick={() => applyPreset("mediator-only")}
                    className="text-[10px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Mediator Only
                  </button>
                </div>
              </div>

              {/* Main SVG Interactive Graph Canvas */}
              <div className="flex-1 flex items-center justify-center min-h-[250px] relative bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-900/50 p-2">
                <span className="absolute top-2 right-3 text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase">Click edges to toggle paths</span>
                
                <svg className="w-full h-[240px] max-w-[480px]" viewBox="0 0 400 240">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={theme === "dark" ? "#6366f1" : "#4f46e5"} />
                    </marker>
                    <marker id="arrow-indigo" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={theme === "dark" ? "#10b981" : "#059669"} />
                    </marker>
                    <marker id="arrow-muted" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={theme === "dark" ? "#1e293b" : "#cbd5e1"} />
                    </marker>
                  </defs>

                  {/* 1. PATH: Seasonality (X) -> Campaign (T) */}
                  <g className="cursor-pointer" onClick={() => setPaths({ ...paths, X_to_T: !paths.X_to_T })}>
                    <path 
                      d="M 200,40 L 100,120" 
                      fill="none" 
                      stroke={paths.X_to_T ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} 
                      strokeWidth={paths.X_to_T ? "2.5" : "1.5"}
                      strokeDasharray={paths.X_to_T ? "0" : "4,4"}
                      markerEnd={paths.X_to_T ? "url(#arrow-indigo)" : "url(#arrow-muted)"}
                      className="hover:stroke-indigo-400 dark:hover:stroke-indigo-300 transition-colors"
                    />
                    <rect x="135" y="65" width="22" height="14" rx="3" fill={theme === "dark" ? "#07090e" : "#ffffff"} stroke={paths.X_to_T ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} strokeWidth="1" />
                    <text x="146" y="75" textAnchor="middle" fill={paths.X_to_T ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#475569" : "#94a3b8")} className="text-[8px] font-mono font-bold select-none">{paths.X_to_T ? "ON" : "OFF"}</text>
                  </g>

                  {/* 2. PATH: Seasonality (X) -> Revenue (Y) */}
                  <g className="cursor-pointer" onClick={() => setPaths({ ...paths, X_to_Y: !paths.X_to_Y })}>
                    <path 
                      d="M 200,40 L 300,120" 
                      fill="none" 
                      stroke={paths.X_to_Y ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} 
                      strokeWidth={paths.X_to_Y ? "2.5" : "1.5"}
                      strokeDasharray={paths.X_to_Y ? "0" : "4,4"}
                      markerEnd={paths.X_to_Y ? "url(#arrow-indigo)" : "url(#arrow-muted)"}
                      className="hover:stroke-indigo-400 dark:hover:stroke-indigo-300 transition-colors"
                    />
                    <rect x="240" y="65" width="22" height="14" rx="3" fill={theme === "dark" ? "#07090e" : "#ffffff"} stroke={paths.X_to_Y ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} strokeWidth="1" />
                    <text x="251" y="75" textAnchor="middle" fill={paths.X_to_Y ? (theme === "dark" ? "#10b981" : "#059669") : (theme === "dark" ? "#475569" : "#94a3b8")} className="text-[8px] font-mono font-bold select-none">{paths.X_to_Y ? "ON" : "OFF"}</text>
                  </g>

                  {/* 3. PATH: Campaign (T) -> Mediator (M) */}
                  <g className="cursor-pointer" onClick={() => setPaths({ ...paths, T_to_M: !paths.T_to_M })}>
                    <path 
                      d="M 100,120 L 200,200" 
                      fill="none" 
                      stroke={paths.T_to_M ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} 
                      strokeWidth={paths.T_to_M ? "2.5" : "1.5"}
                      strokeDasharray={paths.T_to_M ? "0" : "4,4"}
                      markerEnd={paths.T_to_M ? "url(#arrow)" : "url(#arrow-muted)"}
                      className="hover:stroke-indigo-400 dark:hover:stroke-indigo-300 transition-colors"
                    />
                    <rect x="135" y="150" width="22" height="14" rx="3" fill={theme === "dark" ? "#07090e" : "#ffffff"} stroke={paths.T_to_M ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} strokeWidth="1" />
                    <text x="146" y="160" textAnchor="middle" fill={paths.T_to_M ? (theme === "dark" ? "#818cf8" : "#4f46e5") : (theme === "dark" ? "#475569" : "#94a3b8")} className="text-[8px] font-mono font-bold select-none">{paths.T_to_M ? "ON" : "OFF"}</text>
                  </g>

                  {/* 4. PATH: Mediator (M) -> Revenue (Y) */}
                  <g className="cursor-pointer" onClick={() => setPaths({ ...paths, M_to_Y: !paths.M_to_Y })}>
                    <path 
                      d="M 200,200 L 300,120" 
                      fill="none" 
                      stroke={paths.M_to_Y ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} 
                      strokeWidth={paths.M_to_Y ? "2.5" : "1.5"}
                      strokeDasharray={paths.M_to_Y ? "0" : "4,4"}
                      markerEnd={paths.M_to_Y ? "url(#arrow)" : "url(#arrow-muted)"}
                      className="hover:stroke-indigo-400 dark:hover:stroke-indigo-300 transition-colors"
                    />
                    <rect x="240" y="150" width="22" height="14" rx="3" fill={theme === "dark" ? "#07090e" : "#ffffff"} stroke={paths.M_to_Y ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} strokeWidth="1" />
                    <text x="251" y="160" textAnchor="middle" fill={paths.M_to_Y ? (theme === "dark" ? "#818cf8" : "#4f46e5") : (theme === "dark" ? "#475569" : "#94a3b8")} className="text-[8px] font-mono font-bold select-none">{paths.M_to_Y ? "ON" : "OFF"}</text>
                  </g>

                  {/* 5. PATH: Campaign (T) -> Revenue (Y) [Direct] */}
                  <g className="cursor-pointer" onClick={() => setPaths({ ...paths, T_to_Y: !paths.T_to_Y })}>
                    <path 
                      d="M 100,120 L 300,120" 
                      fill="none" 
                      stroke={paths.T_to_Y ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} 
                      strokeWidth={paths.T_to_Y ? "2.5" : "1.5"}
                      strokeDasharray={paths.T_to_Y ? "0" : "4,4"}
                      markerEnd={paths.T_to_Y ? "url(#arrow)" : "url(#arrow-muted)"}
                      className="hover:stroke-indigo-400 dark:hover:stroke-indigo-300 transition-colors"
                    />
                    <rect x="188" y="113" width="22" height="14" rx="3" fill={theme === "dark" ? "#07090e" : "#ffffff"} stroke={paths.T_to_Y ? (theme === "dark" ? "#6366f1" : "#4f46e5") : (theme === "dark" ? "#1e293b" : "#cbd5e1")} strokeWidth="1" />
                    <text x="199" y="123" textAnchor="middle" fill={paths.T_to_Y ? (theme === "dark" ? "#818cf8" : "#4f46e5") : (theme === "dark" ? "#475569" : "#94a3b8")} className="text-[8px] font-mono font-bold select-none">{paths.T_to_Y ? "ON" : "OFF"}</text>
                  </g>

                  {/* Node: Seasonality (X) */}
                  <g>
                    <circle cx="200" cy="40" r="20" fill={theme === "dark" ? "#0c121e" : "#f0fdf4"} stroke={theme === "dark" ? "#10b981" : "#059669"} strokeWidth="2" />
                    <text x="200" y="44" textAnchor="middle" fill={theme === "dark" ? "#10b981" : "#059669"} className="text-[10px] font-bold font-outfit">X</text>
                    <text x="200" y="15" textAnchor="middle" fill={theme === "dark" ? "#cbd5e1" : "#334155"} className="text-[9px] font-semibold font-sans">Seasonality (X)</text>
                  </g>

                  {/* Node: Campaign Spending (T) */}
                  <g>
                    <circle cx="100" cy="120" r="20" fill={theme === "dark" ? "#0c121e" : "#eef2ff"} stroke={theme === "dark" ? "#4f46e5" : "#4338ca"} strokeWidth="2.5" />
                    <text x="100" y="124" textAnchor="middle" fill={theme === "dark" ? "#818cf8" : "#4f46e5"} className="text-[10px] font-bold font-outfit">T</text>
                    <text x="100" y="153" textAnchor="middle" fill={theme === "dark" ? "#cbd5e1" : "#334155"} className="text-[9px] font-semibold font-sans">Campaign Spend (T)</text>
                  </g>

                  {/* Node: Sales Revenue (Y) */}
                  <g>
                    <circle cx="300" cy="120" r="20" fill={theme === "dark" ? "#0c121e" : "#f5f3ff"} stroke={theme === "dark" ? "#6366f1" : "#5b21b6"} strokeWidth="2.5" />
                    <text x="300" y="124" textAnchor="middle" fill={theme === "dark" ? "#818cf8" : "#6366f1"} className="text-[10px] font-bold font-outfit">Y</text>
                    <text x="300" y="153" textAnchor="middle" fill={theme === "dark" ? "#cbd5e1" : "#334155"} className="text-[9px] font-semibold font-sans">Revenue (Y)</text>
                  </g>

                  {/* Node: Direct Visits (M) - Mediator */}
                  <g>
                    <circle cx="200" cy="200" r="20" fill={theme === "dark" ? "#0b0e14" : "#f8fafc"} stroke={theme === "dark" ? "#475569" : "#64748b"} strokeWidth="1.5" />
                    <text x="200" y="204" textAnchor="middle" fill={theme === "dark" ? "#94a3b8" : "#475569"} className="text-[10px] font-bold font-outfit">M</text>
                    <text x="200" y="233" textAnchor="middle" fill={theme === "dark" ? "#cbd5e1" : "#334155"} className="text-[9px] font-semibold font-outfit font-sans">Direct Visits (M)</text>
                  </g>
                </svg>
              </div>

              {/* Adjustments control panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-900 pt-4 mt-2 select-none">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b0e14]">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300 block">Condition on Seasonality (X)</span>
                    <span className="text-[9px] text-slate-500">Removes seasonality correlation bias</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={adjustConfounder} 
                    onChange={() => setAdjustConfounder(!adjustConfounder)}
                    className="h-4 w-4 accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b0e14]">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300 block">Condition on Direct Visits (M)</span>
                    <span className="text-[9px] text-amber-600 dark:text-amber-500/80">Warning: mediator variable</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={adjustMediator} 
                    onChange={() => setAdjustMediator(!adjustMediator)}
                    className="h-4 w-4 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

            </div>

            {/* Causal Estimation Output Panel */}
            <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07090e] rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                
                {/* Header status */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900 pb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Inference Status</span>
                  {sandboxStatus === "unbiased" && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      UNBIASED ESTIMATION
                    </span>
                  )}
                  {sandboxStatus === "confounded" && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                      SPURIOUS BIAS DETECTED
                    </span>
                  )}
                  {sandboxStatus === "overcontrolled" && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      OVER-CONTROLLING BIAS
                    </span>
                  )}
                </div>

                {/* Mathematical Backdoor Formula description */}
                <div className="bg-slate-100 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-900 rounded-xl space-y-2">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <HelpCircle className="h-3 w-3 text-slate-400" /> Active Causal Estimand Formula
                  </div>
                  <div className="font-mono text-xs text-center py-2 text-slate-900 dark:text-white bg-white dark:bg-black/40 rounded border border-slate-200 dark:border-slate-900/60 font-semibold select-all">
                    {sandboxStatus === "unbiased" && (
                      <span>E[Y | do(T)] = {adjustConfounder ? "∑ₓ E[Y | T, X=x] P(X=x)" : "E[Y | T]"}</span>
                    )}
                    {sandboxStatus === "confounded" && (
                      <span className="text-red-600 dark:text-red-400">E[Y | do(T)] ≠ E[Y | T] (Bias)</span>
                    )}
                    {sandboxStatus === "overcontrolled" && (
                      <span className="text-amber-600 dark:text-amber-400">E[Y | do(T)] = E[Y | T, X] (Blocks M path)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-500 leading-relaxed pt-1">
                    {sandboxStatus === "unbiased" && "All confounding paths from covariates are successfully blocked. The statistical estimation accurately identifies the real causal lift."}
                    {sandboxStatus === "confounded" && "Seasonality affects both ad campaigns and purchase frequency. Unadjusted, your model credits seasonality correlation to ad spend!"}
                    {sandboxStatus === "overcontrolled" && "By adjusting for Direct Visits, you're blocking the causal pathway. The direct effect is estimated, but the true total lift is hidden."}
                  </p>
                </div>

                {/* Visual Estimation vs True effect comparative charts */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">True total Causal Effect:</span>
                      <span className="text-slate-900 dark:text-white font-mono font-bold">${trueEffect.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${(trueEffect / 10) * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Estimated Effect (Model Output):</span>
                      <span className={`font-mono font-bold ${sandboxStatus === "unbiased" ? "text-indigo-600 dark:text-indigo-400" : sandboxStatus === "confounded" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        ${estimatedEffect.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${sandboxStatus === "unbiased" ? "bg-indigo-500" : sandboxStatus === "confounded" ? "bg-red-500" : "bg-amber-500"}`} 
                        style={{ width: `${(estimatedEffect / 10) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Sandbox explanatory summary bottom */}
              <div className="text-[11px] text-slate-600 dark:text-slate-500 leading-relaxed border-t border-slate-200 dark:border-slate-900 pt-4 mt-6 flex items-start gap-2">
                <Info className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  Toggle the connections on the left to simulate custom campaign frameworks, and click check-boxes to apply adjustments. Try turning off **Seasonality (X)** adjustment and notice how the estimated effect shoots up.
                </p>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────
          SECTION: DOCUMENTATION PORTAL PREVIEW WIDGET
          ──────────────────────────────────────────────────────────────────────── */}
      <section id="docs-preview" className="py-24 border-t border-slate-200 dark:border-slate-900 bg-slate-100/40 dark:bg-[#06080d]/40 relative">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="text-center max-w-[650px] mx-auto mb-14 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-outfit">
              Core Methodologies & Architecture
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              IMC Causal Lab is built on top of rigorous statistical frameworks. Select a chapter below to view code specifications and equations from the portal.
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080a10] rounded-2xl p-5 md:p-6 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: Chapters selection */}
            <div className="md:col-span-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-900 md:pr-6 select-none shrink-0">
              <button 
                onClick={() => setActiveDocTab("foundations")}
                className={`w-full text-left px-4 py-3 rounded-lg text-xs font-semibold border transition-all ${activeDocTab === "foundations" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-transparent border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/40"}`}
              >
                <div className="opacity-60 text-[9px] uppercase tracking-wider mb-1">Chapter 1</div>
                Causal Structural Models
              </button>
              
              <button 
                onClick={() => setActiveDocTab("doubleml")}
                className={`w-full text-left px-4 py-3 rounded-lg text-xs font-semibold border transition-all ${activeDocTab === "doubleml" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-transparent border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/40"}`}
              >
                <div className="opacity-60 text-[9px] uppercase tracking-wider mb-1">Chapter 3</div>
                Double Machine Learning
              </button>
              
              <button 
                onClick={() => setActiveDocTab("uplift")}
                className={`w-full text-left px-4 py-3 rounded-lg text-xs font-semibold border transition-all ${activeDocTab === "uplift" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-transparent border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/40"}`}
              >
                <div className="opacity-60 text-[9px] uppercase tracking-wider mb-1">Chapter 5</div>
                Uplift Targeting Theory
              </button>
            </div>

            {/* Right Column: Active Excerpt & Code pane */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-6">
              
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">{docContents[activeDocTab].chapter}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">{docContents[activeDocTab].title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{docContents[activeDocTab].excerpt}</p>
              </div>

              {/* Mock code block */}
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-xl border border-slate-300 dark:border-slate-900 font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto">
                <pre>{docContents[activeDocTab].code}</pre>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-900 pt-4">
                <span className="text-[10px] text-slate-500">Excerpt from official research workbook</span>
                <a 
                  href="/docs" 
                  target="_blank" 
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  <BookOpen className="h-4 w-4" /> Open Full Documentation <ArrowRight className="h-3 w-3" />
                </a>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Feature Cards Grid (Value Cards) */}
      <section className="relative z-10 max-w-[1300px] mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
        <div className="text-center max-w-[800px] mx-auto mb-16 space-y-3">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">
            Unveil True Incrementality
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Attribution models fail when confounding bias is active. IMC Causal Lab provides three critical vectors to build true incremental targeting plans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-6 rounded-xl space-y-4 hover:border-indigo-200 dark:hover:border-slate-800 hover:shadow-md transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-outfit">Causal Graph Discovery</h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                Build and audit DAG systems representing the graphical dependencies between campaigns, customer profiles, and seasonal transactions using PyWhy.
              </p>
            </div>
          </div>
          
          <div className="border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-6 rounded-xl space-y-4 hover:border-indigo-200 dark:hover:border-slate-800 hover:shadow-md transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-outfit">Estimator Comparisons</h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                Bench-test estimators (OLS, T-Learner, DR-Learner, Causal Forests) using Uplift Area Under Curve (AUC) metrics to select optimal models.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-6 rounded-xl space-y-4 hover:border-teal-200 dark:hover:border-slate-800 hover:shadow-md transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-slate-900 border border-teal-100 dark:border-slate-800 flex items-center justify-center">
              <Target className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-outfit">Customer Uplift Targeting</h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                Isolate Persuadables and Sure Things within your databases to dynamically shift campaign spend away from waste toward incrementality.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-900 max-w-[1300px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 gap-4">
        <div>&copy; {new Date().getFullYear()} IMC Causal Lab. All rights reserved. Built for modern marketing decision frameworks.</div>
        <div className="flex items-center gap-6">
          <a href="/docs" target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors">Documentation</a>
          <a href="/about" className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors">About</a>
        </div>
      </footer>
    </div>
  );
}
