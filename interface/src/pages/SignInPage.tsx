import { useEffect } from "react";
import { SignIn } from "@/lib/auth-wrapper";
import { Compass, Check, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      sessionStorage.removeItem("guest_demo");
      sessionStorage.removeItem("sessionId");
    } catch (e) {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#06070a] flex flex-col lg:flex-row text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300">
      
      {/* LEFT PANEL: Auth Card Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative z-10 lg:max-w-xl xl:max-w-2xl w-full">
        {/* Background glow for mobile view */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-radial-gradient from-indigo-900/10 to-transparent blur-[100px] pointer-events-none block lg:hidden" />
        
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Brand Logo & Theme Toggle */}
          <div className="flex items-center justify-between w-full select-none">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/10">
                <Compass className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-outfit">
                IMC Causal Lab
              </span>
            </div>
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/50 h-8 w-8 rounded-md shrink-0"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-bold tracking-tight font-outfit text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sign in to your console to manage causal pipelines.</p>
          </div>

          {/* Clerk SignIn form wrapper */}
          <div className="w-full bg-white dark:bg-slate-950/40 backdrop-blur-xl border border-slate-200 dark:border-slate-900 rounded-xl p-1.5 shadow-2xl flex items-center justify-center">
            <SignIn 
              routing="path" 
              path="/sign-in" 
              signUpUrl="/sign-up"
              appearance={{
                variables: {
                  colorPrimary: "#1f56d6", // Platform brand primary color (deep blue/indigo)
                  colorBackground: theme === "dark" ? "#090d16" : "#ffffff",
                  colorInputBackground: theme === "dark" ? "#070b13" : "#f8fafc",
                  colorText: theme === "dark" ? "#f8fafc" : "#0f172a",
                  colorTextSecondary: theme === "dark" ? "#94a3b8" : "#64748b",
                  colorInputText: theme === "dark" ? "#f8fafc" : "#0f172a",
                  colorBorder: theme === "dark" ? "#1e293b" : "#e2e8f0",
                },
                elements: {
                  card: `border shadow-none p-4 ${theme === "dark" ? "bg-[#090d16] border-slate-900" : "bg-white border-slate-200"}`,
                  headerTitle: `${theme === "dark" ? "text-white" : "text-slate-900"} font-sans text-lg font-bold`,
                  headerSubtitle: `${theme === "dark" ? "text-slate-400" : "text-slate-500"} font-sans text-xs`,
                  socialButtonsBlockButton: `${theme === "dark" ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-white" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"} border font-medium text-xs`,
                  socialButtonsBlockButtonText: `${theme === "dark" ? "text-white" : "text-slate-800"} font-medium`,
                  formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 text-white font-semibold text-xs border-0 py-2.5",
                  footerActionText: `${theme === "dark" ? "text-slate-400" : "text-slate-500"} text-xs`,
                  footerActionLink: `${theme === "dark" ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-500"} font-semibold`,
                  formFieldLabel: `${theme === "dark" ? "text-slate-300" : "text-slate-700"} text-xs font-semibold`,
                  formFieldInput: `border text-xs py-2 ${theme === "dark" ? "bg-[#070b13] border-slate-800 text-white focus:border-indigo-500 focus:ring-indigo-500" : "bg-[#f8fafc] border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"}`,
                  dividerLine: theme === "dark" ? "bg-slate-850" : "bg-slate-200",
                  dividerText: `${theme === "dark" ? "text-slate-500 bg-[#090d16]" : "text-slate-400 bg-white"} text-[10px]`,
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Key Benefits & Visual Graphic (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-tr from-[#0a1526] via-[#070e17] to-[#050608] border-l border-slate-900/50 flex-col justify-between p-12 relative overflow-hidden">
        
        {/* Subtle background nodes pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{
            backgroundImage: `radial-gradient(#6366f1 1.5px, transparent 1.5px)`,
            backgroundSize: "32px 32px"
          }}
        />
        <div className="absolute top-[20%] right-[-10%] w-[350px] h-[350px] rounded-full bg-radial-gradient from-indigo-500/10 to-transparent blur-[80px] pointer-events-none" />

        {/* Decorative Causal SVG Graph lines in background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <svg className="w-[80%] h-[350px]" viewBox="0 0 400 300">
            <path d="M 80,150 Q 200,50 320,150" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="6,6" />
            <path d="M 80,150 Q 200,250 320,150" fill="none" stroke="#3b82f6" strokeWidth="3" />
            <circle cx="80" cy="150" r="14" fill="#090d16" stroke="#6366f1" strokeWidth="2" />
            <circle cx="200" cy="90" r="14" fill="#090d16" stroke="#64748b" strokeWidth="1.5" />
            <circle cx="320" cy="150" r="14" fill="#090d16" stroke="#3b82f6" strokeWidth="2" />
          </svg>
        </div>

        {/* Top area content */}
        <div className="relative z-10 flex items-center gap-1.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          Double Machine Learning Platform
        </div>

        {/* Central Key Benefits Section */}
        <div className="relative z-10 space-y-8 max-w-lg my-auto text-left">
          <div className="space-y-2">
            <span className="text-[11px] font-mono tracking-wider text-indigo-400 uppercase font-semibold">Enterprise Sandbox</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-outfit text-white leading-tight">
              IMC Causal Lab
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Discover true incrementality and optimize marketing budget allocation with causal AI.
            </p>
          </div>

          <div className="space-y-5">
            {/* Point 1 */}
            <div className="flex gap-3 items-start">
              <div className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Unified Causal AI Platform</h3>
                <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 leading-relaxed">
                  Map structural causal graphs (DAGs) and analyze multi-channel campaigns in a single interactive console.
                </p>
              </div>
            </div>

            {/* Point 2 */}
            <div className="flex gap-3 items-start">
              <div className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100">De-biased Machine Learning (DoubleML)</h3>
                <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 leading-relaxed">
                  Control for high-dimensional confounders using state-of-the-art Double ML orthogonalization algorithms.
                </p>
              </div>
            </div>

            {/* Point 3 */}
            <div className="flex gap-3 items-start">
              <div className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100">Optimized Budget Allocation</h3>
                <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 leading-relaxed">
                  Target high-uplift customer cohorts (Persuadables) and eliminate wasted spend on un-incrementable cohorts.
                </p>
              </div>
            </div>
          </div>

          {/* Trusted By Grid */}
          <div className="pt-6 border-t border-slate-900/60 space-y-3">
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase block">Trusted by teams at</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 opacity-50 text-[11px] font-bold tracking-wider font-outfit text-slate-400">
              <span>FINANCIAL TIMES</span>
              <span>TOYOTA</span>
              <span>L'OREAL</span>
              <span>COINBASE</span>
              <span>ADOBE</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[10px] text-slate-600 font-mono flex items-center justify-between">
          <span>IMC Causal Lab v1.2</span>
          <span>© {new Date().getFullYear()} Causal Lab</span>
        </div>

      </div>

    </div>
  );
}
