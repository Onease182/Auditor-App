'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiProps {
  trigger: boolean
}

// Lightweight CSS-based confetti — no external dependencies.
// Generates 30 colored squares that fall from the top with random
// horizontal positions, delays, and rotation.
export function Confetti({ trigger }: ConfettiProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (trigger) {
      setShow(true)
      const timer = setTimeout(() => setShow(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [trigger])

  const colors = [
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-primary',
  ]

  const pieces = Array.from({ length: 30 }, (_, i) => {
    const left = Math.random() * 100
    const delay = Math.random() * 0.3
    const duration = 1.5 + Math.random() * 1
    const rotation = Math.random() * 360
    const color = colors[i % colors.length]
    const size = 6 + Math.random() * 6
    return { left, delay, duration, rotation, color, size, id: i }
  })

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
          {pieces.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: -20, x: `${p.left}vw`, rotate: 0 }}
              animate={{
                opacity: [1, 1, 0],
                y: ['−2vh', '100vh'],
                x: [`${p.left}vw`, `${p.left + (Math.random() * 20 - 10)}vw`],
                rotate: p.rotation,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeIn',
                opacity: { delay: p.duration - 0.3, duration: 0.3 },
              }}
              className={`absolute ${p.color}`}
              style={{
                width: p.size,
                height: p.size,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
