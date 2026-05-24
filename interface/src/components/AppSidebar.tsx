import { Home, LayoutDashboard, PlusCircle, History, Workflow, Info, Boxes, PanelLeftClose, PanelLeftOpen, Activity, ScrollText, BookOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserButton, useAuth } from "@/lib/auth-wrapper";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Workspace",
    items: [
      { title: "Home", url: "/home", icon: Home, end: true },
      { title: "Pipeline Monitor", url: "/monitor", icon: Activity },
      { title: "Logs & Diagnostics", url: "/logs", icon: ScrollText },
      { title: "Documentation", url: "/docs", icon: BookOpen, target: "_blank" },
      { title: "About Platform", url: "/about", icon: Info },
    ],
  },
  {
    label: "Causal Lab",
    items: [
      { title: "New Analysis", url: "/new-analysis", icon: PlusCircle },
      { title: "Session History", url: "/sessions", icon: History },
      { title: "Discover Studio", url: "/discover", icon: Workflow },
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);
  const { isSignedIn } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className={cn("h-12 flex items-center border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
          <div className="h-7 w-7 rounded-md bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shrink-0">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="ml-2 text-sm font-semibold text-sidebar-foreground tracking-tight">
              Causal Console
            </span>
          )}
        </div>

        {groups.map((g) => (
          <SidebarGroup key={g.label} className="px-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-2 mt-2">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = isActive(item.url, item.end);
                  return (
                    <SidebarMenuItem key={item.title}>
                       <SidebarMenuButton asChild isActive={active} className="relative h-8">
                        <NavLink
                          to={item.url}
                          end={item.end}
                          target={item.target}
                          className={cn(
                            "group/navlink flex items-center gap-2 rounded-md text-[13px] transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm transition-colors",
                              active ? "bg-sidebar-primary" : "bg-transparent"
                            )}
                          />
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-2 gap-2">
        {/* User Button / Auth status */}
        <div className={cn("flex items-center gap-2 p-1 rounded-md hover:bg-sidebar-accent/40", collapsed ? "justify-center" : "px-2")}>
          {isSignedIn ? (
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-6 w-6",
                    userButtonTrigger: "focus:shadow-none focus:outline-none"
                  }
                }}
              />
              {!collapsed && (
                <span className="text-[12px] text-sidebar-foreground/80 truncate font-medium">
                  Account Details
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <NavLink 
                to="/sign-in" 
                className="flex items-center gap-2 text-[12px] text-sidebar-foreground/80 hover:text-sidebar-foreground w-full"
              >
                <Boxes className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
                {!collapsed && <span>Sign In</span>}
              </NavLink>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex items-center gap-2 h-8 rounded-md text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors w-full",
            collapsed ? "justify-center px-0" : "px-2"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
