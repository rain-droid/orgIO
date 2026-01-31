"use client"

import * as React from "react"
import {
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Send,
  Settings2,
  Zap,
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
import type { Brief } from "@/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string
    email: string
    avatar: string
  }
  briefs?: Brief[]
  onBriefSelect?: (brief: Brief) => void
  onViewChange?: (view: 'dashboard' | 'briefs' | 'reviews') => void
  currentView?: string
}

export function AppSidebar({ 
  user,
  briefs = [],
  onBriefSelect,
  onViewChange,
  currentView = 'dashboard',
  ...props 
}: AppSidebarProps) {
  const navMain = [
    {
      title: "Dashboard",
      url: "#",
      icon: LayoutDashboard,
      isActive: currentView === 'dashboard',
      onClick: () => onViewChange?.('dashboard'),
    },
    {
      title: "Briefs",
      url: "#",
      icon: FileText,
      isActive: currentView === 'briefs',
      onClick: () => onViewChange?.('briefs'),
      items: briefs.slice(0, 5).map(brief => ({
        title: brief.title,
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
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Notifications",
          url: "#",
        },
      ],
    },
  ]

  const projects = briefs.filter(b => b.status === 'active').slice(0, 3).map(brief => ({
    name: brief.title,
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
              <a href="#">
                <div className="bg-emerald-500 text-black flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Home className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Drift</span>
                  <span className="truncate text-xs text-muted-foreground">Sprint Planning</span>
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
