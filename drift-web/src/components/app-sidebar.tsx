"use client"

import * as React from "react"
import {
  FileText,
  Home,
  Inbox,
  LifeBuoy,
  Send,
  Zap,
  Plug,
  CheckCircle2,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Brief, Role } from "@/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string
    email: string
    avatar: string
  }
  briefs?: Brief[]
  onBriefSelect?: (brief: Brief) => void
  onViewChange?: (view: 'home' | 'briefs' | 'reviews' | 'mcp-hub') => void
  currentView?: string
  userRole?: Role
}

export function AppSidebar({ 
  user,
  briefs = [],
  onBriefSelect,
  onViewChange,
  currentView = 'home',
  userRole = 'dev',
  ...props 
}: AppSidebarProps) {
  const navMain = [
    {
      title: "Home",
      url: "#",
      icon: Home,
      isActive: currentView === 'home',
      onClick: () => onViewChange?.('home'),
    },
    {
      title: "Projects",
      url: "#",
      icon: FileText,
      isActive: currentView === 'briefs',
      onClick: () => onViewChange?.('briefs'),
      items: briefs.slice(0, 5).map(brief => ({
        title: brief.name,
        url: "#",
        onClick: () => onBriefSelect?.(brief),
      })),
    },
    {
      title: "Reviews",
      url: "#",
      icon: Inbox,
      isActive: currentView === 'reviews',
      onClick: () => onViewChange?.('reviews'),
    },
    {
      title: "MCP Hub",
      url: "#",
      icon: Zap,
      isActive: currentView === 'mcp-hub',
      onClick: () => onViewChange?.('mcp-hub'),
    },
  ]

  const projects = briefs.filter(b => b.status === 'active').slice(0, 3).map(brief => ({
    name: brief.name,
    url: "#",
    icon: Zap,
    onClick: () => onBriefSelect?.(brief),
  }))

  // MCP Hub - Connected integrations
  const mcpIntegrations = [
    { name: 'Notion', connected: true, icon: '📝' },
    { name: 'Slack', connected: true, icon: '💬' },
    { name: 'Jira', connected: true, icon: '🎯' },
    { name: 'GitHub', connected: true, icon: '🐙' },
    { name: 'Linear', connected: false, icon: '📊' },
    { name: 'Figma', connected: false, icon: '🎨' },
  ]

  const navSecondary = [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ]

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#" onClick={() => onViewChange?.('home')}>
                <div className="bg-foreground text-background flex aspect-square size-8 items-center justify-center">
                  <span className="font-bold text-sm">D</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Drift</span>
                  <span className="truncate text-xs text-muted-foreground font-mono">
                    {userRole.toUpperCase()} View
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {projects.length > 0 && <NavProjects projects={projects} />}
        
        {/* MCP Hub */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            <Plug size={14} />
            <span>MCP Hub</span>
          </div>
          <div className="space-y-1 mt-1">
            {mcpIntegrations.map((integration) => (
              <div 
                key={integration.name}
                className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{integration.icon}</span>
                  <span>{integration.name}</span>
                </div>
                {integration.connected ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Connect</span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
      </SidebarFooter>
    </Sidebar>
  )
}
