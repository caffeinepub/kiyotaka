import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { Lock, Zap } from "lucide-react";
import { motion } from "motion/react";

interface LoginGateProps {
  title?: string;
  description?: string;
}

export function LoginGate({
  title = "Authentication Required",
  description = "Connect your identity to access this page.",
}: LoginGateProps) {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6"
    >
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center">
          <Zap className="w-3 h-3 text-yellow-400" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-display text-xl font-bold text-foreground">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs">{description}</p>
      </div>
      <Button
        onClick={() => login()}
        disabled={isLoggingIn}
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        data-ocid="auth.primary_button"
      >
        {isLoggingIn ? (
          <>
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Connect Identity
          </>
        )}
      </Button>
    </motion.div>
  );
}
