import Link from "next/link";
import { Bot, Shield, Database, Zap } from "lucide-react";
import { auth } from "../../auth";

export default async function LandingPage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30 overflow-hidden">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-semibold tracking-tight text-lg">Life OS</span>
        </div>
        <div>
          {session ? (
            <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors">
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/api/auth/signin" className="px-5 py-2.5 rounded-full bg-white text-slate-900 font-medium hover:bg-slate-200 transition-colors">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 flex flex-col items-center text-center px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
          Your Second Brain, <br />Powered by AI.
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
          Stop losing track of your thoughts. Speak your mind, and Life OS will intelligently document, categorize, and archive your life securely.
        </p>

        {session ? (
           <Link href="/dashboard" className="px-8 py-4 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 hover:scale-105 transition-all outline-none focus:ring-4 focus:ring-indigo-500/50 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
             Access Your Brain
           </Link>
        ) : (
          <Link href="/api/auth/signin" className="px-8 py-4 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 hover:scale-105 transition-all outline-none focus:ring-4 focus:ring-indigo-500/50 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
            Start Your Archive
          </Link>
        )}
      </section>

      {/* Feature Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 grid sm:grid-cols-3 gap-8 border-t border-slate-800/50">
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
            <Zap className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold mb-3">Frictionless Capture</h3>
          <p className="text-slate-400 leading-relaxed">
            Just tap the microphone and speak. Whether it's a random idea, a financial goal, or a family task, we catch it all.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold mb-3">100% Private</h3>
          <p className="text-slate-400 leading-relaxed">
            Your data is strictly isolated in a private database. Only you can read, write, or query your Second Brain.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
            <Database className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold mb-3">Retrieval Augmented</h3>
          <p className="text-slate-400 leading-relaxed">
            Ask questions about your own life. The AI reads your past thoughts to give you highly contextual, personalized answers.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-12 border-t border-slate-800/50 text-slate-500 text-sm">
        <p>Built with Next.js, NextAuth, and MongoDB.</p>
      </footer>
    </main>
  );
}
