'use client'

import { motion } from 'framer-motion'
import { MessageCircle, BarChart3, Lightbulb, ArrowRight, Shield, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LandingPageProps {
  onStartDecision: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

const features = [
  {
    icon: MessageCircle,
    title: 'Conversation, not forms',
    description: 'Describe your situation naturally. I\'ll guide you through the process with thoughtful questions.',
  },
  {
    icon: BarChart3,
    title: 'Weighted scoring you can inspect',
    description: 'Set priorities for each criterion and see exactly how your options score.',
  },
  {
    icon: Lightbulb,
    title: 'Explainable results',
    description: 'Understand why an option won and what would change the outcome.',
  },
]

const steps = [
  { number: '01', title: 'Describe your dilemma', description: 'Tell me what you\'re deciding between' },
  { number: '02', title: 'Confirm options & criteria', description: 'I\'ll extract what matters—you refine it' },
  { number: '03', title: 'Set importance (1-10)', description: 'Weight criteria by how much they matter to you' },
  { number: '04', title: 'Answer a few questions', description: 'Rate each option through targeted questions' },
]

export function LandingPage({ onStartDecision }: LandingPageProps) {
  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6 pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto text-center relative z-10"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-tight"
          >
            Make complex decisions
            <br />
            <span className="text-primary">with clarity.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Describe your dilemma. I'll extract options and criteria, learn your priorities through conversation, and explain the recommendation.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={onStartDecision}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-medium shadow-warm-lg hover:shadow-warm-xl transition-all duration-300 group"
            >
              Start a decision
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={scrollToHowItWorks}
              className="text-muted-foreground hover:text-foreground px-8 py-6 text-lg"
            >
              See how it works
              <ChevronDown className="ml-2 h-5 w-5 animate-bounce" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-accent/5 to-transparent">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-5xl mx-auto"
        >
          <motion.h2
            variants={itemVariants}
            className="text-2xl sm:text-3xl font-semibold text-center text-foreground mb-16"
          >
            A thoughtful approach to decisions
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Card className="p-8 h-full border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-warm-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-4xl mx-auto"
        >
          <motion.h2
            variants={itemVariants}
            className="text-2xl sm:text-3xl font-semibold text-center text-foreground mb-16"
          >
            How it works
          </motion.h2>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden sm:block" />

            <div className="space-y-8">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex gap-6 items-start"
                >
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{step.number}</span>
                  </div>
                  <div className="pt-3">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Final result */}
            <motion.div variants={itemVariants} className="mt-12 ml-22 pl-6 border-l-2 border-accent/30">
              <div className="flex items-center gap-3 text-accent-foreground">
                <div className="w-3 h-3 rounded-full bg-accent" />
                <span className="font-semibold">Get ranked results + explanation</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Trust Line */}
      <section className="py-16 px-6 border-t border-border/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Shield className="h-5 w-5 text-primary/70" />
            <p className="text-sm sm:text-base">
              No signup required. Your decisions stay in your browser.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6">
            Ready to decide?
          </h2>
          <Button
            size="lg"
            onClick={onStartDecision}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-medium shadow-warm-lg hover:shadow-warm-xl transition-all duration-300 group"
          >
            Start a decision
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </section>
    </div>
  )
}
