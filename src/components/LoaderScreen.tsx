import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ezLogoColor from "@/assets/ez-journey-logo-color.svg";
import ezLogoWhite from "@/assets/ez-journey-logo-white-color.svg";

interface LoaderScreenProps {
  onComplete: () => void;
}

export default function LoaderScreen({ onComplete }: LoaderScreenProps) {
  const [visible, setVisible] = useState(true);

  // Detect dark mode from <html> class or system preference
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      (!document.documentElement.classList.contains("light") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  // Skip loader on subsequent visits within same session
  useEffect(() => {
    if (sessionStorage.getItem('ez_loader_shown')) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem('ez_loader_shown', '1');
    const timer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: isDark ? "#0a0a0f" : "#ffffff" }}
        >
          {/* Radial glow */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: isDark
                ? "radial-gradient(circle, hsl(var(--brand-accent) / 0.12) 0%, hsl(var(--primary) / 0.10) 45%, transparent 70%)"
                : "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, hsl(var(--brand-accent) / 0.06) 45%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          {/* Logo + text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center gap-5"
          >
            <img
              src={isDark ? ezLogoWhite : ezLogoColor}
              alt="EZ Journey"
              className="h-16 w-auto"
            />



            <div
              className="mt-2 h-[3px] w-48 overflow-hidden rounded-full"
              style={{ background: isDark ? "hsl(var(--foreground) / 0.1)" : "hsl(var(--foreground) / 0.08)" }}
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, hsl(var(--brand-accent)), hsl(var(--primary)))",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
