
"use client";
import React, { useId, useEffect, useState } from "react";
import { motion, useAnimation } from "motion/react";
import { cn } from "../../lib/utils";

type ParticleProps = {
  id: string;
  x: string;
  y: string;
  targetX: string;
  targetY: string;
  color: string;
  delay: number;
  duration: number;
  size: number;
};

export const SparklesCore = (props: {
  id?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  particleDensity?: number;
  className?: string;
  particleColor?: string;
  speed?: number;
}) => {
  const {
    id,
    background = "transparent",
    minSize = 0.6,
    maxSize = 1.4,
    particleDensity = 100,
    className,
    particleColor = "#FFFFFF",
    speed = 1,
  } = props;
  const [particles, setParticles] = useState<ParticleProps[]>([]);
  const generatedId = useId();

  useEffect(() => {
    const generatedParticles = Array.from({ length: particleDensity }).map(
      (_, i) => {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        return {
          id: `${generatedId}-${i}`,
          x: `${x}%`,
          y: `${y}%`,
          targetX: `${x + (Math.random() - 0.5) * 5}%`,
          targetY: `${y + (Math.random() - 0.5) * 5}%`,
          color: particleColor,
          delay: Math.random() * 2,
          duration: Math.random() * 2 + 2,
          size: Math.random() * (maxSize - minSize) + minSize,
        };
      }
    );
    setParticles(generatedParticles);
  }, [particleDensity, particleColor, minSize, maxSize, generatedId]);

  return (
    <div
      id={id || generatedId}
      className={cn("h-full w-full relative overflow-hidden", className)}
      style={{
        background: background,
      }}
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            x: [particle.x, particle.targetX],
            y: [particle.y, particle.targetY],
          }}
          transition={{
            duration: particle.duration / speed,
            repeat: Infinity,
            delay: particle.delay,
            ease: "linear",
          }}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            left: particle.x,
            top: particle.y,
          }}
        />
      ))}
    </div>
  );
};
