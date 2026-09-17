import type { Direction, ScoreBreakdown, SignalContribution } from "@/lib/types";

const round = (n: number) => Math.round(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

function deriveDirection(earned: number, weight: number): Direction {
  if (weight === 0) return "neutral";
  const ratio = earned / weight;
  if (ratio >= 0.6) return "positive";
  if (ratio <= 0.25) return "negative";
  return "neutral";
}

/**
 * Accumulates signal contributions and normalises the result over the weight we
 * actually had data for. A lead missing revenue isn't punished for the gap — it
 * is scored on its remaining signals and reports lower confidence instead.
 */
export function createBreakdown() {
  const contributions: SignalContribution[] = [];
  let availableWeight = 0;
  let totalWeight = 0;

  return {
    add(args: {
      key: string;
      label: string;
      weight: number;
      earned: number;
      detail: string;
      direction?: Direction;
    }) {
      totalWeight += args.weight;
      availableWeight += args.weight;
      contributions.push({
        key: args.key,
        label: args.label,
        detail: args.detail,
        weight: args.weight,
        earned: args.earned,
        direction: args.direction ?? deriveDirection(args.earned, args.weight),
      });
    },

    /** A signal we had no data for: counted in total weight, not in the denominator. */
    unknown(args: { key: string; label: string; weight: number; detail?: string }) {
      totalWeight += args.weight;
      contributions.push({
        key: args.key,
        label: args.label,
        detail: args.detail ?? "No data available",
        weight: args.weight,
        earned: 0,
        direction: "neutral",
      });
    },

    build(): ScoreBreakdown {
      const earned = contributions.reduce((sum, c) => sum + c.earned, 0);
      return {
        score: availableWeight === 0 ? 0 : round((earned / availableWeight) * 100),
        contributions,
        confidence: totalWeight === 0 ? 0 : round2(availableWeight / totalWeight),
      };
    },
  };
}
