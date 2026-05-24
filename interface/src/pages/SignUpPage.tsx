import { SignUp } from "@/lib/auth-wrapper";
import { Compass, Quote } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#06070a] flex flex-col lg:flex-row text-white overflow-hidden font-sans">
      
      {/* LEFT PANEL: Auth Card Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative z-10 lg:max-w-xl xl:max-w-2xl w-full">
        {/* Background glow for mobile view */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-radial-gradient from-emerald-900/10 to-transparent blur-[100px] pointer-events-none block lg:hidden" />
        
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 select-none self-start">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <Compass className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white font-outfit">
              IMC Causal Lab
            </span>
          </div>

          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-bold tracking-tight font-outfit text-white">Create an account</h1>
            <p className="text-xs text-slate-400">Join the causal lab to analyze true marketing incrementality.</p>
          </div>

          {/* Clerk SignUp form wrapper */}
          <div className="w-full bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-1.5 shadow-2xl flex items-center justify-center">
            <SignUp 
              routing="path" 
              path="/sign-up" 
              signInUrl="/sign-in"
              appearance={{
                variables: {
                  colorPrimary: "#10b981", // Emerald primary accent
                  colorBackground: "#090d16",
                  colorInputBackground: "#070b13",
                  colorText: "#f8fafc",
                  colorTextSecondary: "#94a3b8",
                  colorInputText: "#f8fafc",
                  colorBorder: "#1e293b",
                },
                elements: {
                  card: "bg-[#090d16] border border-slate-900 shadow-none p-4",
                  headerTitle: "text-white font-sans text-lg font-bold",
                  headerSubtitle: "text-slate-400 font-sans text-xs",
                  socialButtonsBlockButton: "bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium text-xs",
                  socialButtonsBlockButtonText: "text-white font-medium",
                  formButtonPrimary: "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-semibold text-xs border-0 py-2.5",
                  footerActionText: "text-slate-400 text-xs",
                  footerActionLink: "text-emerald-400 hover:text-emerald-300 font-semibold",
                  formFieldLabel: "text-slate-300 text-xs font-semibold",
                  formFieldInput: "bg-[#070b13] border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 py-2 text-xs",
                  dividerLine: "bg-slate-850",
                  dividerText: "text-slate-500 bg-[#090d16] text-[10px]",
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Testimonial & Visual Graphic (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-tr from-[#041d14] via-[#05110e] to-[#050608] border-l border-slate-900/50 flex-col justify-between p-12 relative overflow-hidden">
        
        {/* Subtle background nodes pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{
            backgroundImage: `radial-gradient(#10b981 1.5px, transparent 1.5px)`,
            backgroundSize: "32px 32px"
          }}
        />
        <div className="absolute top-[20%] right-[-10%] w-[350px] h-[350px] rounded-full bg-radial-gradient from-emerald-500/10 to-transparent blur-[80px] pointer-events-none" />

        {/* Decorative Causal SVG Graph lines in background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <svg className="w-[80%] h-[350px]" viewBox="0 0 400 300">
            <path d="M 80,150 Q 200,50 320,150" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6,6" />
            <path d="M 80,150 Q 200,250 320,150" fill="none" stroke="#6366f1" strokeWidth="3" />
            <circle cx="80" cy="150" r="14" fill="#041d14" stroke="#10b981" strokeWidth="2" />
            <circle cx="200" cy="90" r="14" fill="#041d14" stroke="#64748b" strokeWidth="1.5" />
            <circle cx="320" cy="150" r="14" fill="#041d14" stroke="#6366f1" strokeWidth="2" />
          </svg>
        </div>

        {/* Top area content */}
        <div className="relative z-10 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold uppercase tracking-wider font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Double Machine Learning Platform
        </div>

        {/* Central Testimonial Quote */}
        <div className="relative z-10 space-y-6 max-w-md my-auto">
          <Quote className="h-10 w-10 text-emerald-500 opacity-60" />
          <h2 className="text-xl sm:text-2xl font-bold leading-normal font-outfit text-slate-100">
            "Working with Causal Lab is just fun. It makes finding true marketing incrementality and shaping optimal budget policies so much easier."
          </h2>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center font-bold text-xs">
              A
            </div>
            <div>
              <div className="text-xs font-bold text-white">@analytics_director</div>
              <div className="text-[10px] text-slate-500 font-mono">Global Growth & Acquisition</div>
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
