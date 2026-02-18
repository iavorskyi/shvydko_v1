"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";
import { checkAchievements } from "@/lib/utils/achievements";
import { showToast } from "@/components/shared/Toast";
import { BADGES } from "@/types";

export function useAchievements() {
  const check = useCallback(async (userId: string) => {
    try {
      const result = await checkAchievements(userId);

      if (result.newAchievements.length > 0) {
        // Fire confetti for each new achievement
        result.newAchievements.forEach((type, index) => {
          const badge = BADGES[type];
          if (!badge) return;

          setTimeout(() => {
            // Show toast notification
            showToast({
              type: "achievement",
              title: `Нове досягнення: ${badge.name}!`,
              description: badge.description,
              icon: badge.icon,
              duration: 4000,
            });

            // Fire confetti
            fireConfetti();
          }, index * 1200);
        });
      }

      return result;
    } catch (error) {
      console.error("Achievement check failed:", error);
      return { newAchievements: [] };
    }
  }, []);

  return { checkAchievements: check };
}

function fireConfetti() {
  const defaults = {
    spread: 360,
    ticks: 80,
    gravity: 0.8,
    decay: 0.92,
    startVelocity: 25,
    colors: ["#6750A4", "#D0BCFF", "#FFD700", "#FF6B6B", "#4CAF50"],
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(80 * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
