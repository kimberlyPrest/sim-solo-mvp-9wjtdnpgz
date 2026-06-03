import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'

type MemberRole = Database['public']['Enums']['member_role']

export interface Organization {
  id: string
  name: string
  role: MemberRole
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  organization: Organization | null
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  hasRole: (roles: MemberRole[]) => boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfileAndOrg = async (userId: string) => {
    const [profileRes, orgRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('organization_members')
        .select('role, organizations(id, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single(),
    ])

    if (profileRes.data) setProfile(profileRes.data)

    if (orgRes.data && orgRes.data.organizations) {
      const orgData = Array.isArray(orgRes.data.organizations)
        ? orgRes.data.organizations[0]
        : orgRes.data.organizations

      setOrganization({
        id: orgData.id,
        name: orgData.name,
        role: orgRes.data.role,
      })
    } else {
      setOrganization(null)
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfileAndOrg(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setOrganization(null)
        setLoading(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfileAndOrg(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const hasRole = (roles: MemberRole[]) => {
    if (!organization) return false
    return roles.includes(organization.role)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, organization, signUp, signIn, signOut, hasRole, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}
