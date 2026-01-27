'use client';

import { motion } from 'framer-motion';
import { MessageCircle, BarChart3, Lightbulb, ArrowRight, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface LandingPageProps {
  onStartDecision: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const features = [
  {
    icon: MessageCircle,
    title: 'Conversation, not forms',
    description:
      "Describe your situation naturally. I'll guide you through the process with thoughtful questions.",
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
];

const steps = [
  {
    number: '01',
    title: 'Describe your dilemma',
    description: "Tell me what you're deciding between",
  },
  {
    number: '02',
    title: 'Confirm options & criteria',
    description: "I'll extract what matters—you refine it",
  },
  {
    number: '03',
    title: 'Set importance (1-10)',
    description: 'Weight criteria by how much they matter to you',
  },
  {
    number: '04',
    title: 'Answer a few questions',
    description: 'Rate each option through targeted questions',
  },
];

export function LandingPage({ onStartDecision }: LandingPageProps) {
  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] items-center justify-center px-6 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Make complex decisions
            <br />
            <span className="text-primary">with clarity.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Describe your dilemma. I'll extract options and criteria, learn your priorities through
            conversation, and explain the recommendation.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col justify-center gap-4 sm:flex-row"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                size="lg"
                onClick={onStartDecision}
                className="hover:shadow-warm-xl group relative overflow-hidden bg-primary px-8 py-6 text-lg font-medium text-primary-foreground shadow-warm-lg transition-all duration-300 hover:bg-primary/90"
              >
                <span className="relative z-10 flex items-center">
                  Start a decision
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="ghost"
                size="lg"
                onClick={scrollToHowItWorks}
                className="px-8 py-6 text-lg text-muted-foreground hover:text-foreground"
              >
                See how it works
                <ChevronDown className="ml-2 h-5 w-5 animate-bounce" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="bg-gradient-to-b from-transparent via-accent/5 to-transparent px-6 py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto max-w-5xl"
        >
          <motion.h2
            variants={itemVariants}
            className="mb-16 text-center text-2xl font-semibold text-foreground sm:text-3xl"
          >
            A thoughtful approach to decisions
          </motion.h2>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Card className="h-full border-border/50 bg-card/50 p-8 shadow-md backdrop-blur-sm transition-shadow duration-300 hover:shadow-warm-lg">
                  <motion.div
                    className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                    whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon className="h-6 w-6 text-primary" />
                  </motion.div>
                  <h3 className="mb-3 text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="px-6 py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto max-w-4xl"
        >
          <motion.h2
            variants={itemVariants}
            className="mb-16 text-center text-2xl font-semibold text-foreground sm:text-3xl"
          >
            How it works
          </motion.h2>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute bottom-8 left-8 top-8 hidden w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent sm:block" />

            <div className="space-y-8">
              {steps.map((step, index) => (
                <motion.div key={index} variants={itemVariants} className="flex items-start gap-6">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-sm font-bold text-primary">{step.number}</span>
                  </div>
                  <div className="pt-3">
                    <h3 className="mb-1 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Final result */}
            <motion.div variants={itemVariants} className="mt-8 flex items-start gap-6">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-green-500/5">
                <span className="text-lg font-bold text-green-600">✓</span>
              </div>
              <div className="pt-3">
                <h3 className="mb-1 text-lg font-semibold text-foreground">Get your results</h3>
                <p className="text-muted-foreground">
                  Ranked options with clear explanations of why
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Trust Line */}
      <section className="border-t border-border/50 px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
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
      <section className="px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="mb-6 text-2xl font-semibold text-foreground sm:text-3xl">
            Ready to decide?
          </h2>
          <Button
            size="lg"
            onClick={onStartDecision}
            className="hover:shadow-warm-xl group bg-primary px-8 py-6 text-lg font-medium text-primary-foreground shadow-warm-lg transition-all duration-300 hover:bg-primary/90"
          >
            Start a decision
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
