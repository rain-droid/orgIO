import { useState, useRef } from 'react'
import { useUser, useOrganizationList, useAuth } from '@clerk/clerk-react'
import { FileText, Users, Code, Palette, Briefcase, ArrowRight, Check, Loader2 } from 'lucide-react'
import type { Role } from '@/types'
import { api } from '@/lib/api'

interface OnboardingProps {
  onComplete: () => void
}

type Step = 'welcome' | 'organization' | 'role'

export function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useUser()
  const { getToken, orgId } = useAuth()
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true }
  })
  const selectedOrgIdRef = useRef<string | null>(null)
  
  const [step, setStep] = useState<Step>('welcome')
  const [orgName, setOrgName] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !createOrganization) return
    setLoading(true)
    setError(null)
    try {
      const org = await createOrganization({ name: orgName })
      selectedOrgIdRef.current = org.id
      await setActive?.({ organization: org.id })
      setStep('role')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectExistingOrg = async (selectedOrgId: string) => {
    setLoading(true)
    try {
      selectedOrgIdRef.current = selectedOrgId
      await setActive?.({ organization: selectedOrgId })
      setStep('role')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select organization')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRole = async (role: Role) => {
    if (!user) return
    setSelectedRole(role)
    setLoading(true)
    setError(null)
    try {
      const token = await getToken({ skipCache: true })
      if (!token) {
        throw new Error('Unable to get authentication token.')
      }
      
      api.setToken(token)
      const finalOrgId = selectedOrgIdRef.current || orgId
      await api.updateUserRole(role, finalOrgId || undefined)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
      setSelectedRole(null)
    } finally {
      setLoading(false)
    }
  }

  const existingOrgs = userMemberships?.data || []

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['welcome', 'organization', 'role'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`size-8 rounded flex items-center justify-center text-sm font-medium transition-colors ${
                step === s 
                  ? 'bg-foreground text-background' 
                  : ['welcome', 'organization', 'role'].indexOf(step) > i
                  ? 'bg-foreground/20 text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {['welcome', 'organization', 'role'].indexOf(step) > i ? <Check className="size-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 mx-2 ${
                ['welcome', 'organization', 'role'].indexOf(step) > i ? 'bg-foreground' : 'bg-muted'
              }`} />}
            </div>
          ))}
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="flex items-center justify-center">
              <div className="bg-foreground text-background size-16 flex items-center justify-center rounded">
                <FileText className="size-8" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold mb-2">Welcome to Drift</h1>
              <p className="text-muted-foreground">AI-powered sprint planning for modern teams</p>
            </div>

            <div className="relative">
              <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
              <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
              <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
              <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

              <div className="border bg-background p-6 space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Briefcase className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">For Product Managers</div>
                    <div className="text-xs text-muted-foreground">User stories, acceptance criteria, timeline</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Code className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">For Developers</div>
                    <div className="text-xs text-muted-foreground">Architecture, API specs, code snippets</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Palette className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">For Designers</div>
                    <div className="text-xs text-muted-foreground">User flows, components, design system</div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setStep('organization')}
              className="btn-primary w-full py-3 rounded text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              Get Started <ArrowRight className="size-4" />
            </button>
          </div>
        )}

        {/* Organization Step */}
        {step === 'organization' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
              <div className="size-12 rounded bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="size-6" />
              </div>
              <h1 className="text-xl font-semibold mb-2">Set up your workspace</h1>
              <p className="text-muted-foreground text-sm">Create or join an organization</p>
            </div>

            <div className="relative">
              <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
              <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
              <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
              <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

              <div className="border bg-background p-6 space-y-4">
                <h3 className="font-medium text-sm">Create new organization</h3>
                <div className="flex gap-2">
                  <input
                    placeholder="Organization name..."
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                    className="flex-1 bg-transparent border rounded px-3 py-2 text-sm placeholder:text-muted-foreground/50 input-focus"
                  />
                  <button 
                    onClick={handleCreateOrg}
                    disabled={!orgName.trim() || loading}
                    className="btn-primary px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
                  </button>
                </div>
              </div>
            </div>

            {existingOrgs.length > 0 && (
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-6 space-y-4">
                  <h3 className="font-medium text-sm">Or select existing</h3>
                  <div className="space-y-2">
                    {existingOrgs.map((membership) => (
                      <button
                        key={membership.organization.id}
                        onClick={() => handleSelectExistingOrg(membership.organization.id)}
                        disabled={loading}
                        className="w-full p-3 rounded border bg-background hover:bg-muted/50 transition-colors flex items-center gap-3 text-left"
                      >
                        <div className="size-10 rounded bg-muted flex items-center justify-center font-semibold">
                          {membership.organization.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{membership.organization.name}</div>
                          <div className="text-xs text-muted-foreground">{membership.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Role Step */}
        {step === 'role' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-2">What's your role?</h1>
              <p className="text-muted-foreground text-sm">This helps us personalize your experience</p>
            </div>

            <div className="space-y-3">
              {[
                { role: 'pm' as Role, icon: Briefcase, title: 'Product Manager', desc: 'I define features and manage sprints' },
                { role: 'dev' as Role, icon: Code, title: 'Developer', desc: 'I build and implement features' },
                { role: 'designer' as Role, icon: Palette, title: 'Designer', desc: 'I design interfaces and experiences' },
              ].map(({ role, icon: Icon, title, desc }) => (
                <div key={role} className="relative">
                  <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                  <button
                    onClick={() => handleSelectRole(role)}
                    disabled={loading}
                    className={`w-full p-4 border bg-background transition-all flex items-center gap-4 text-left card-hover ${
                      selectedRole === role ? 'border-foreground' : ''
                    }`}
                  >
                    <div className="size-12 rounded bg-muted flex items-center justify-center">
                      <Icon className="size-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{title}</div>
                      <div className="text-sm text-muted-foreground">{desc}</div>
                    </div>
                    {selectedRole === role && loading && (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
