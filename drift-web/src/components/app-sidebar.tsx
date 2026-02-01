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
      icon: Plug,
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
                  <span className="font-bold text-sm">O</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Orgio</span>
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
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
      </SidebarFooter>
    </Sidebar>
  )
}
