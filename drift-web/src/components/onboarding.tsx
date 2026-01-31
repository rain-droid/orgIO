import { useState } from 'react'
import { useUser, useOrganizationList, useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Users, Code, Palette, Briefcase, ArrowRight, Check, Loader2 } from 'lucide-react'
import type { Role } from '@/types'
import { syncUser, updateUserRole } from '@/lib/data'

interface OnboardingProps {
  onComplete: () => void
}

type Step = 'welcome' | 'organization' | 'role'

export function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useUser()
  const { orgId } = useAuth()
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true }
  })
  
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
      await setActive?.({ organization: org.id })
      setStep('role')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectExistingOrg = async (orgId: string) => {
    setLoading(true)
    try {
      await setActive?.({ organization: orgId })
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
      // Sync user first
      await syncUser({
        id: user.id,
        orgId: orgId ?? null,
        email: user.primaryEmailAddress?.emailAddress || '',
        name: user.fullName || user.username || 'User',
        avatarUrl: user.imageUrl ?? null,
      })
      // Then update role
      await updateUserRole(user.id, role)
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
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['welcome', 'organization', 'role'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : ['welcome', 'organization', 'role'].indexOf(step) > i
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {['welcome', 'organization', 'role'].indexOf(step) > i ? <Check className="size-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 mx-2 ${
                ['welcome', 'organization', 'role'].indexOf(step) > i ? 'bg-emerald-500/50' : 'bg-muted'
              }`} />}
            </div>
          ))}
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-center gap-3">
              <div className="bg-primary text-primary-foreground flex aspect-square size-16 items-center justify-center rounded-2xl">
                <FileText className="size-8" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome to Drift</h1>
              <p className="text-muted-foreground">AI-powered sprint planning for modern teams</p>
            </div>
            <div className="grid gap-3 text-left p-6 rounded-xl border bg-card">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
                  <Briefcase className="size-4 text-pink-400" />
                </div>
                <div>
                  <div className="font-medium">For Product Managers</div>
                  <div className="text-sm text-muted-foreground">User stories, acceptance criteria, timeline tracking</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Code className="size-4 text-cyan-400" />
                </div>
                <div>
                  <div className="font-medium">For Developers</div>
                  <div className="text-sm text-muted-foreground">Architecture diagrams, API specs, code snippets</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Palette className="size-4 text-violet-400" />
                </div>
                <div>
                  <div className="font-medium">For Designers</div>
                  <div className="text-sm text-muted-foreground">User flows, component specs, design system</div>
                </div>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={() => setStep('organization')}
              className="bg-primary hover:bg-primary/90 text-black w-full"
            >
              Get Started
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Organization Step */}
        {step === 'organization' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Users className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Set up your workspace</h1>
              <p className="text-muted-foreground">Create a new organization or join an existing one</p>
            </div>

            {/* Create New */}
            <div className="p-6 rounded-xl border bg-card space-y-4">
              <h3 className="font-semibold">Create new organization</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Organization name..."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleCreateOrg}
                  disabled={!orgName.trim() || loading}
                  className="bg-primary hover:bg-primary/90 text-black"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </div>

            {/* Existing Orgs */}
            {existingOrgs.length > 0 && (
              <div className="p-6 rounded-xl border bg-card space-y-4">
                <h3 className="font-semibold">Or select existing</h3>
                <div className="space-y-2">
                  {existingOrgs.map((membership) => (
                    <button
                      key={membership.organization.id}
                      onClick={() => handleSelectExistingOrg(membership.organization.id)}
                      disabled={loading}
                      className="w-full p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
                    >
                      <div className="size-10 rounded-lg bg-muted flex items-center justify-center font-semibold">
                        {membership.organization.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{membership.organization.name}</div>
                        <div className="text-xs text-muted-foreground">{membership.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Role Step */}
        {step === 'role' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">What's your role?</h1>
              <p className="text-muted-foreground">This helps us personalize your experience</p>
            </div>

            <div className="space-y-3">
              {[
                { role: 'pm' as Role, icon: Briefcase, color: 'pink', title: 'Product Manager', desc: 'I define features and manage sprints' },
                { role: 'dev' as Role, icon: Code, color: 'cyan', title: 'Developer', desc: 'I build and implement features' },
                { role: 'designer' as Role, icon: Palette, color: 'violet', title: 'Designer', desc: 'I design interfaces and experiences' },
              ].map(({ role, icon: Icon, color, title, desc }) => (
                <button
                  key={role}
                  onClick={() => handleSelectRole(role)}
                  disabled={loading}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 text-left ${
                    selectedRole === role 
                      ? `bg-${color}-500/20 border-${color}-500/50` 
                      : 'bg-card hover:bg-accent/50 border-border'
                  }`}
                >
                  <div className={`size-12 rounded-xl flex items-center justify-center ${
                    color === 'pink' ? 'bg-pink-500/20' : color === 'cyan' ? 'bg-cyan-500/20' : 'bg-violet-500/20'
                  }`}>
                    <Icon className={`size-6 ${
                      color === 'pink' ? 'text-pink-400' : color === 'cyan' ? 'text-cyan-400' : 'text-violet-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">{desc}</div>
                  </div>
                  {selectedRole === role && loading && (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
