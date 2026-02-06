import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 500,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    // Skip animation for very small changes
    if (Math.abs(endValue - startValue) < 0.001) {
      setDisplayValue(endValue);
      previousValue.current = endValue;
      return;
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <span className={`animated-counter ${className}`}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

// Specialized version for currency
interface AnimatedCurrencyProps {
  cents: number;
  duration?: number;
  className?: string;
}

export function AnimatedCurrency({
  cents,
  duration = 500,
  className = '',
}: AnimatedCurrencyProps) {
  const dollars = cents / 100;
  return (
    <AnimatedCounter
      value={dollars}
      duration={duration}
      decimals={2}
      prefix="$"
      className={className}
    />
  );
}

// Token counter with K/M suffixes
interface AnimatedTokenCounterProps {
  tokens: number;
  duration?: number;
  className?: string;
}

export function AnimatedTokenCounter({
  tokens,
  duration = 500,
  className = '',
}: AnimatedTokenCounterProps) {
  const [displayValue, setDisplayValue] = useState(tokens);
  const previousValue = useRef(tokens);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = tokens;
    const startTime = performance.now();

    if (Math.abs(endValue - startValue) < 1) {
      setDisplayValue(endValue);
      previousValue.current = endValue;
      return;
    }

    let animationRef: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(Math.round(current));

      if (progress < 1) {
        animationRef = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    animationRef = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef);
  }, [tokens, duration]);

  const formatTokens = (n: number): string => {
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1)}M`;
    }
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}K`;
    }
    return n.toString();
  };

  return (
    <span className={`animated-counter font-mono ${className}`}>
      {formatTokens(displayValue)}
    </span>
  );
}
