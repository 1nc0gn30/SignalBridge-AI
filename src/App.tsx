import { motion } from "motion/react";
import { Shield, Zap, MessageSquare, Code, Lock, Cpu, ArrowRight, Github, Globe, Terminal } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { generateLandingImage } from "./lib/gemini";

const Navbar = ({ onPrimaryAction }: { onPrimaryAction: () => void }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass m-4 rounded-2xl shadow-[0_20px_60px_rgba(9,18,38,0.55)]">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-signal-blue to-blue-500 rounded-lg flex items-center justify-center shadow-[0_6px_20px_rgba(44,107,237,0.4)]">
        <MessageSquare className="text-white w-5 h-5" />
      </div>
      <span className="font-display font-bold text-xl tracking-tight">SignalBridge</span>
    </div>
    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
      <a href="#features" className="hover:text-white transition-colors">Features</a>
      <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
      <a href="#security" className="hover:text-white transition-colors">Security</a>
    </div>
    <div className="flex items-center gap-4">
      <button onClick={onPrimaryAction} className="hidden sm:block text-sm font-semibold text-gray-200 hover:text-white transition-colors">Login</button>
      <button onClick={onPrimaryAction} className="bg-signal-blue hover:bg-blue-600 px-5 py-2 rounded-xl text-sm font-bold transition-all transform hover:scale-105 shadow-[0_10px_28px_rgba(44,107,237,0.45)]">
        Get Started
      </button>
    </div>
  </nav>
);

const Hero = ({ onPrimaryAction }: { onPrimaryAction: () => void }) => {
  const [heroImage, setHeroImage] = useState<string | null>(null);

  useEffect(() => {
    generateLandingImage("A futuristic, sleek 3D visualization of a secure messaging interface connecting to a neural network of AI agents. Neon blue accents, dark background, high-tech aesthetic.").then(setHeroImage);
  }, []);

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-signal-blue/25 blur-3xl pointer-events-none" />
      <div className="absolute top-16 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal-blue/10 border border-signal-blue/20 text-signal-blue text-xs font-bold mb-6">
            <Zap className="w-3 h-3" />
            <span>NOW IN BETA</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            Your Signal. <br />
            <span className="text-gradient">Your Agents.</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
            Connect your private Signal messages to local AI agents, custom backends, and complex orchestrators. Secure, end-to-end encrypted, and entirely under your control.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onPrimaryAction} className="bg-signal-blue hover:bg-blue-600 px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all group shadow-[0_16px_36px_rgba(44,107,237,0.35)]">
              Start Building
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="glass hover:bg-white/10 px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all">
              <Github className="w-5 h-5" />
              View on GitHub
            </button>
          </div>
          <div className="mt-12 flex items-center gap-6 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>E2E Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span>Local First</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-signal-blue/20 blur-3xl rounded-full opacity-50" />
          <div className="relative glass rounded-3xl p-2 aspect-video overflow-hidden shadow-2xl border-white/20">
            {heroImage ? (
              <img 
                src={heroImage} 
                alt="SignalBridge Interface" 
                className="w-full h-full object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-signal-surface animate-pulse flex items-center justify-center">
                <Cpu className="w-12 h-12 text-signal-blue/20" />
              </div>
            )}
          </div>
          {/* Floating UI Elements */}
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 glass p-4 rounded-2xl shadow-xl hidden md:block border-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <Shield className="text-green-500 w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold">Secure Tunnel</p>
                <p className="text-[10px] text-gray-400">Active & Encrypted</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="glass p-8 rounded-3xl border-white/5 hover:border-signal-blue/30 transition-all duration-300 group hover:-translate-y-1"
  >
    <div className="w-14 h-14 bg-signal-blue/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-signal-blue/20 transition-colors">
      <Icon className="text-signal-blue w-7 h-7" />
    </div>
    <h3 className="font-display font-bold text-2xl mb-4">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{description}</p>
  </motion.div>
);

const Features = () => (
  <section id="features" className="py-24 px-6 bg-signal-dark/50">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">Built for Privacy, <br /><span className="text-gradient">Engineered for Power</span></h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          SignalBridge provides the missing link between your favorite private messenger and your custom AI infrastructure.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <FeatureCard 
          icon={Lock}
          title="End-to-End Privacy"
          description="Your messages never leave the Signal protocol's encryption until they reach your local orchestrator. No middleman, ever."
          delay={0.1}
        />
        <FeatureCard 
          icon={Cpu}
          title="Local Orchestration"
          description="Run your own LLMs, agents, or scripts locally. SignalBridge acts as the secure gateway for your personal AI."
          delay={0.2}
        />
        <FeatureCard 
          icon={Code}
          title="API First"
          description="Simple webhooks and API keys make it trivial to connect any backend. Support for Python, Node.js, and Go."
          delay={0.3}
        />
      </div>
    </div>
  </section>
);

const HowItWorks = () => {
  const [stepImage, setStepImage] = useState<string | null>(null);

  useEffect(() => {
    generateLandingImage("A clean, technical diagram showing a phone with Signal app, a secure bridge icon, and a local server rack. Minimalist line art style, blue and white.").then(setStepImage);
  }, []);

  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="relative glass rounded-3xl p-4 aspect-square max-w-md mx-auto border-white/10">
              {stepImage ? (
                <img src={stepImage} alt="Architecture" className="w-full h-full object-cover rounded-2xl opacity-80" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-signal-surface animate-pulse rounded-2xl" />
              )}
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="font-display text-4xl font-bold mb-8">How it Works</h2>
            <div className="space-y-8">
              {[
                { step: "01", title: "Setup your Bridge", desc: "Deploy the SignalBridge orchestrator on your local machine or private cloud." },
                { step: "02", title: "Connect Signal", desc: "Link your Signal account using our secure, open-source CLI tool." },
                { step: "03", title: "Define Agents", desc: "Configure your local agents or backend endpoints using simple YAML or JSON." },
                { step: "04", title: "Chat Privately", desc: "Start talking to your agents directly from your Signal app on any device." }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6"
                >
                  <span className="font-display font-black text-4xl text-signal-blue/20">{item.step}</span>
                  <div>
                    <h4 className="font-bold text-xl mb-2">{item.title}</h4>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("form-name", "waitlist");
    formData.append("email", email);

    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData as any).toString(),
      });
      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {status === "success" ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 glass rounded-2xl text-green-400 font-bold"
        >
          You're on the list! We'll be in touch soon.
        </motion.div>
      ) : (
        <form 
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3"
          method="POST"
          action="/"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          name="waitlist"
        >
          <input type="hidden" name="form-name" value="waitlist" />
          <input type="text" name="bot-field" className="hidden" tabIndex={-1} autoComplete="off" />
          <input 
            type="email" 
            name="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:border-signal-blue focus:ring-2 focus:ring-signal-blue/25 transition-colors"
          />
          <button 
            type="submit"
            className="bg-signal-blue hover:bg-blue-600 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap shadow-[0_12px_30px_rgba(44,107,237,0.35)]"
          >
            Join Waitlist
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="text-red-400 text-sm mt-2">Something went wrong. Please try again.</p>
      )}
    </div>
  );
};

const SEOPost = () => (
  <section className="py-24 px-6 bg-signal-dark/20 border-y border-white/5">
    <div className="max-w-4xl mx-auto">
      <div className="glass p-8 md:p-12 rounded-[2.5rem] border-white/10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-signal-blue/20 rounded-full flex items-center justify-center">
            <Cpu className="text-signal-blue w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-signal-blue">ENGINEERING BLOG</p>
            <h3 className="text-2xl font-display font-bold">The Future of Private AI Orchestration</h3>
          </div>
        </div>
        <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed space-y-6">
          <p>
            In an era where data privacy is increasingly under threat, the intersection of secure messaging and artificial intelligence represents a critical frontier. <strong>SignalBridge</strong> is not just a tool; it's a paradigm shift in how we interact with local AI agents.
          </p>
          <p>
            By leveraging the <strong>Signal Protocol</strong>, we ensure that your personal data remains end-to-end encrypted from your mobile device directly to your local hardware. Whether you're running <em>Llama 3</em>, <em>Mistral</em>, or custom backend orchestrators, SignalBridge provides the secure tunnel required for truly private digital assistants.
          </p>
          <h4 className="text-white font-bold text-xl mt-8">Why Local-First Matters</h4>
          <p>
            Cloud-based AI providers often require you to sacrifice privacy for convenience. SignalBridge flips this script. By hosting your own bridge, you maintain 100% ownership of your conversation history and model outputs. This is the "Zero-Knowledge" standard that <strong>Tech Pro</strong> envisioned for the modern web.
          </p>
          <div className="flex items-center gap-2 pt-8 border-t border-white/5 mt-8">
            <span className="text-sm text-gray-500 italic">Published by</span>
            <span className="text-sm font-bold text-white">Tech Pro</span>
            <span className="text-gray-600 mx-2">•</span>
            <span className="text-sm text-gray-500">5 min read</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const LegalModal = ({ title, content, isOpen, onClose }: { title: string, content: string, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 rounded-3xl border-white/20 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <Zap className="w-6 h-6 rotate-45" />
        </button>
        <h2 className="font-display text-3xl font-bold mb-6">{title}</h2>
        <div className="text-gray-400 space-y-4 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </motion.div>
    </div>
  );
};

const CTA = () => (
  <section id="waitlist" className="py-24 px-6 scroll-mt-32">
    <div className="max-w-5xl mx-auto glass rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden border-white/10 shadow-[0_30px_80px_rgba(7,12,24,0.55)]">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-signal-blue/20 to-transparent pointer-events-none" />
      <div className="absolute -bottom-20 -right-16 h-60 w-60 rounded-full bg-cyan-400/15 blur-3xl pointer-events-none" />
      <h2 className="font-display text-4xl md:text-6xl font-bold mb-8 relative z-10">Ready to bridge the gap?</h2>
      <p className="text-gray-400 text-xl mb-12 max-w-2xl mx-auto relative z-10">
        Join the private waitlist today and start building your own secure AI ecosystem on top of Signal.
      </p>
      <div className="relative z-10">
        <WaitlistForm />
      </div>
    </div>
  </section>
);

const Footer = () => {
  const [modal, setModal] = useState<{ title: string, content: string } | null>(null);

  const terms = `Terms of Service for SignalBridge AI

1. Acceptance of Terms
By accessing signalbridge.757tech.pro, you agree to be bound by these terms.

2. Description of Service
SignalBridge provides software to connect Signal messaging with local AI agents. We do not host your data.

3. Privacy
Your privacy is paramount. We do not collect message content. See our Privacy Policy for details.

4. User Responsibility
You are responsible for the local agents and backends you connect to SignalBridge.

5. Limitation of Liability
SignalBridge is provided "as is" without warranty of any kind.`;

  const privacy = `Privacy Policy for SignalBridge AI

1. Data Collection
We do not collect, store, or transmit your Signal messages. All decryption happens locally on your device.

2. Waitlist Information
If you join our waitlist, we store your email address solely for the purpose of project updates.

3. Cookies
We use minimal cookies for site functionality and performance.

4. Third Parties
We do not sell your data to third parties. Netlify handles our form submissions securely.`;

  return (
    <footer className="py-12 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-signal-blue rounded flex items-center justify-center">
            <MessageSquare className="text-white w-4 h-4" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">SignalBridge</span>
        </div>
        <div className="flex gap-8 text-sm text-gray-500">
          <button onClick={() => setModal({ title: "Privacy Policy", content: privacy })} className="hover:text-white transition-colors">Privacy Policy</button>
          <button onClick={() => setModal({ title: "Terms of Service", content: terms })} className="hover:text-white transition-colors">Terms of Service</button>
          <a href="https://signalbridge.757tech.pro" className="hover:text-white transition-colors">signalbridge.757tech.pro</a>
        </div>
        <div className="text-center md:text-right">
          <p className="text-sm text-gray-500">Created by <span className="text-white font-bold">Tech Pro</span></p>
          <p className="text-xs text-gray-600 mt-1">© 2026 SignalBridge AI. All rights reserved.</p>
        </div>
      </div>
      <LegalModal 
        isOpen={!!modal} 
        title={modal?.title || ""} 
        content={modal?.content || ""} 
        onClose={() => setModal(null)} 
      />
    </footer>
  );
};

const Security = () => (
  <section id="security" className="py-24 px-6 bg-gradient-to-b from-black to-signal-dark/30">
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-8">Uncompromising <br /><span className="text-gradient">Security by Design</span></h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-signal-blue/10 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="text-signal-blue w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">Zero-Knowledge Architecture</h4>
                <p className="text-gray-400">We never see your keys or your messages. Everything is decrypted locally on your hardware.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-signal-blue/10 rounded-xl flex items-center justify-center shrink-0">
                <Lock className="text-signal-blue w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">Signal Protocol Native</h4>
                <p className="text-gray-400">Leverages the world's most trusted encryption protocol for every single interaction.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-signal-blue/10 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="text-signal-blue w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-lg mb-1">Local API Keys</h4>
                <p className="text-gray-400">Manage your own API keys for local agents or cloud backends securely within your orchestrator.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-10 bg-signal-blue/10 blur-3xl rounded-full" />
          <div className="glass p-8 rounded-3xl border-white/10 relative">
            <pre className="font-mono text-xs text-blue-400 overflow-x-auto">
              <code>{`// Secure Orchestrator Config
{
  "bridge": {
    "protocol": "signal-v2",
    "encryption": "x3dh",
    "local_only": true
  },
  "agents": [
    {
      "id": "local-llama-3",
      "endpoint": "http://localhost:11434",
      "api_key": "env.LOCAL_KEY"
    }
  ]
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default function App() {
  const scrollToWaitlist = () => {
    const waitlistSection = document.getElementById("waitlist");
    waitlistSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      const emailInput = document.querySelector<HTMLInputElement>('#waitlist input[name="email"]');
      emailInput?.focus();
    }, 450);
  };

  return (
    <div className="min-h-screen bg-black selection:bg-signal-blue selection:text-white">
      <Navbar onPrimaryAction={scrollToWaitlist} />
      <main>
        <Hero onPrimaryAction={scrollToWaitlist} />
        <Features />
        <HowItWorks />
        <Security />
        <SEOPost />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
