import { createFileRoute, Link } from '@tanstack/react-router'
import { Settings, Sidebar as SidebarIcon } from 'lucide-react'
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
} from '../components/ui/sidebar'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent />
        <SidebarFooter className="mt-auto border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild variant="outline" size="lg" className="justify-start">
                <Link to="/settings/general">
                  <Settings />
                  <span>Settings</span>
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
            <h1 className="text-center text-sm font-semibold tracking-wide">Home</h1>
            <span className="h-9 w-9" aria-hidden="true" />
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <p className="text-base text-muted-foreground">Home page content goes here.</p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
