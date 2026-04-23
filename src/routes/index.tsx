import React from 'react';
import { createRoot } from 'react-dom/client';
import { createFileRoute } from '@tanstack/react-router'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Sidebar } from "@/components/ui/sidebar";

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <SidebarProvider>
      <Sidebar />
      <main>
        <SidebarTrigger />
        <p>Hello World!</p>
      </main>
    </SidebarProvider>
  )
}