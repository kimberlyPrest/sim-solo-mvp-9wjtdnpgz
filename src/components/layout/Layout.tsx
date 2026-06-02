import { Outlet, Navigate } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import { useAuth } from '@/hooks/use-auth'

import { supabase } from '@/lib/supabase/client'

export function Layout() {
  const { session, loading, organization } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full bg-primary/20"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!loading && session && !organization) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20 p-4">
        <div className="text-center max-w-md bg-background p-8 rounded-xl shadow-sm border">
          <h2 className="text-2xl font-bold mb-2">Acesso Pendente</h2>
          <p className="text-muted-foreground mb-6">
            Sua conta ainda não está vinculada a nenhuma organização no sistema. Por favor, contate
            o administrador para liberar seu acesso.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AppSidebar />
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
