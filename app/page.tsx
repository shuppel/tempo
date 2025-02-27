"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { BrainDump } from "@/app/features/brain-dump"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CloudSun, Save, Smartphone, Lock, ArrowRight } from "lucide-react"
import AuthModal from "./components/AuthModal"
import { useRouter } from "next/navigation"
import Link from "next/link"

// Define types for the story and task objects
interface Task {
  title: string;
  isFrog: boolean;
  duration?: number;
}

interface Story {
  title: string;
  tasks: Task[];
  estimatedDuration: number;
}

interface Stats {
  totalTasks: number
  totalDuration: number
  totalStories: number
  totalFrogs: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    totalDuration: 0,
    totalStories: 0,
    totalFrogs: 0
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()

  // Check authentication status
  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true)
      const { data } = await supabase.auth.getSession()
      setIsAuthenticated(!!data.session)
      setIsLoading(false)
    }
    
    checkUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setIsAuthenticated(!!session)
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleTasksProcessed = (stories: Story[]) => {
    const totalTasks = stories.reduce((acc, story) => acc + story.tasks.length, 0)
    const totalDuration = stories.reduce((acc, story) => acc + story.estimatedDuration, 0)
    const totalFrogs = stories.reduce((acc, story) => 
      acc + story.tasks.filter((task) => task.isFrog).length, 0)
    
    setStats({
      totalTasks,
      totalDuration,
      totalStories: stories.length,
      totalFrogs
    })
  }

  const handleSaveSession = () => {
    if (isAuthenticated) {
      router.push('/sessions')
    } else {
      setShowAuthModal(true)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Authenticated User View - Brain Dump functionality
  if (isAuthenticated) {
    return (
      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-6xl">
        <div className="grid gap-14">
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md group-hover:blur-lg transition-all duration-500 opacity-70"></div>
                <Image 
                  src="/assets/features/brain_dump.png" 
                  alt="Brain Dump Logo" 
                  width={80} 
                  height={80} 
                  className="rounded-lg shadow-md relative z-10"
                />
              </div>
              <h1 className="text-5xl font-bold tracking-tight flex items-center">Brain Dump</h1>
            </div>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-4xl">
              Unload your thoughts and turn them into actionable tasks. Simply list everything on your mind—we&apos;ll help you organize it into focused work sessions so you can stop planning and start doing.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
            <div className="relative">
              <BrainDump onTasksProcessed={handleTasksProcessed} />
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl blur-sm -z-10"></div>
            </div>

            <div className="space-y-8">
              <Card className="border-2 rounded-xl shadow-md overflow-hidden bg-gradient-to-b from-card to-card/60">
                <CardHeader className="space-y-3 pb-4">
                  <CardTitle className="text-2xl font-bold tracking-tight">Session Preview</CardTitle>
                  <CardDescription className="text-body text-base text-muted-foreground">
                    Your productivity metrics at a glance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-7">
                    <div>
                      <dt className="ui-label mb-2 text-sm font-medium uppercase tracking-wider">Tasks</dt>
                      <dd className="text-4xl font-heading text-foreground/90">{stats.totalTasks}</dd>
                    </div>
                    <div>
                      <dt className="ui-label mb-2 text-sm font-medium uppercase tracking-wider">Estimated Time</dt>
                      <dd className="text-4xl font-heading text-foreground/90">
                        {stats.totalDuration > 59 
                          ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
                          : `${stats.totalDuration}m`}
                      </dd>
                    </div>
                    <div>
                      <dt className="ui-label mb-2 text-sm font-medium uppercase tracking-wider">Focus Stories</dt>
                      <dd className="text-4xl font-heading text-foreground/90">{stats.totalStories}</dd>
                    </div>
                    {stats.totalFrogs > 0 && (
                      <div>
                        <dt className="ui-label mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wider">
                          <span>Eat These Frogs First</span>
                          <span className="text-lg">🐸</span>
                        </dt>
                        <dd className="text-4xl font-heading text-primary animate-pulse-subtle">{stats.totalFrogs}</dd>
                      </div>
                    )}
                  </dl>

                  {stats.totalTasks > 0 && (
                    <div className="mt-10">
                      <Button 
                        className="w-full rounded-xl py-5 shadow-sm hover:shadow-md transition-all duration-300 bg-primary hover:bg-primary/90" 
                        size="lg" 
                        onClick={handleSaveSession}
                      >
                        <Save className="mr-2 h-5 w-5" />
                        Save Session
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Footer for authenticated view */}
        <footer className="border-t py-16 mt-20 bg-gradient-to-t from-muted/40 to-muted/10">
          <div className="grid gap-10 md:gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <Image 
                  src="/assets/logo/toro_logo.png" 
                  alt="Toro Logo" 
                  width={45} 
                  height={45}
                  className="object-contain drop-shadow-sm"
                />
                <span className="text-2xl font-heading bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Toro</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Task management that works with you, not against you. Stop planning, start doing.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-5 text-lg">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Brain Dump
                  </Link>
                </li>
                <li>
                  <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Sessions
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-5 text-lg">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Nodetus Integrators LLC. All rights reserved.</p>
          </div>
        </footer>
      </main>
    )
  }

  // Non-Authenticated User View - Landing page with prominent call to action
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="py-16 md:py-28 bg-gradient-to-b from-background via-background/95 to-muted/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid gap-12 md:gap-16 md:grid-cols-2 items-center">
            <div className="space-y-8 md:space-y-10">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Stop Planning. <span className="text-primary relative inline-block animate-pulse-subtle">Start Doing.</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Turn your messy to-do list into focused work sessions. Toro helps you organize, 
                prioritize, and actually complete what matters most.
              </p>
              <div className="flex flex-col sm:flex-row gap-5 pt-6">
                <AuthModal 
                  trigger={
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-medium px-8 py-6 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
                      Get Started - It&apos;s Free
                    </Button>
                  }
                  defaultOpen={showAuthModal}
                  onOpenChange={setShowAuthModal}
                />
                <Button variant="outline" size="lg" className="py-6 rounded-xl border-2 hover:bg-muted/60 transition-all duration-300" onClick={() => router.push('/sessions')}>
                  Try Without Account <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-card border-2 rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-70 z-10"></div>
                <Image 
                  src="/assets/features/brain_dump.png" 
                  alt="Toro Brain Dump Preview"
                  width={600}
                  height={400}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">How Toro Works</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Toro combines proven productivity techniques with smart tools to help you 
              cut through the chaos and focus on what actually matters.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <Card className="border-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-b from-card to-card/60 h-full">
              <CardHeader>
                <CloudSun className="h-9 w-9 text-primary mb-3" />
                <CardTitle className="text-xl tracking-tight">Brain Dump</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Get it all out of your head. Just type your thoughts and tasks as they come—messy, unstructured, however they exist in your mind.
                </p>
              </CardContent>
            </Card>
            
            {/* Feature 2 */}
            <Card className="border-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-b from-card to-card/60 h-full">
              <CardHeader>
                <Save className="h-9 w-9 text-primary mb-3" />
                <CardTitle className="text-xl tracking-tight">Smart Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  We&apos;ll organize your tasks into meaningful groups that minimize context switching and maximize your natural workflow.
                </p>
              </CardContent>
            </Card>
            
            {/* Feature 3 */}
            <Card className="border-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-b from-card to-card/60 h-full">
              <CardHeader>
                <Smartphone className="h-9 w-9 text-primary mb-3" />
                <CardTitle className="text-xl tracking-tight">Focused Timers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Work in timed sessions that keep you accountable and productive. Break work into bite-sized chunks that actually get done.
                </p>
              </CardContent>
            </Card>
            
            {/* Feature 4 */}
            <Card className="border-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-b from-card to-card/60 h-full">
              <CardHeader>
                <Lock className="h-9 w-9 text-primary mb-3" />
                <CardTitle className="text-xl tracking-tight">Eat That Frog</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  We highlight your hardest tasks—your &quot;frogs&quot;—so you can tackle them first when your energy and willpower are strongest.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-20 text-center">
            <AuthModal 
              trigger={
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-medium px-10 py-6 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl">
                  Start Getting Things Done
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 bg-gradient-to-t from-muted/40 to-muted/10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid gap-10 md:gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <Image 
                  src="/assets/logo/toro_logo.png" 
                  alt="Toro Logo" 
                  width={45} 
                  height={45}
                  className="object-contain drop-shadow-sm"
                />
                <span className="text-2xl font-heading bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Toro</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Task management that works with you, not against you. Stop planning, start doing.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-5 text-lg">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Brain Dump
                  </Link>
                </li>
                <li>
                  <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Sessions
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-5 text-lg">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary group-hover:w-2 transition-all duration-300"></span>
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Nodetus Integrators LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

