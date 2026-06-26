import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { ArrowLeft, Plug, Settings2 } from 'lucide-react'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const matchRoute = useMatchRoute()
  const isGeneralActive = !!matchRoute({ to: '/settings/general' })
  const isIntegrationsActive = !!matchRoute({ to: '/settings/integrations' })

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem className="mx-5 mt-5">
              <SidebarMenuButton asChild isActive={isGeneralActive}>
                <Link to="/settings/general">
                  <Settings2 className="h-4 w-4" />
                  <span>General</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="mx-5 my-2">
              <SidebarMenuButton asChild isActive={isIntegrationsActive}>
                <Link to="/settings/integrations">
                  <Plug className="h-4 w-4" />
                  <span>Integrations</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mt-auto border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild variant="outline" size="lg" className="justify-start">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>Back</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center px-4">
            <SidebarTrigger />
            <h1 className="text-center text-sm font-semibold tracking-wide">Settings</h1>
            <span className="h-9 w-9" aria-hidden="true" />
          </div>
        </header>
        <main className="min-h-svh bg-background p-6 text-foreground">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
