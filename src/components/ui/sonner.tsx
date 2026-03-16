import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-[hsl(142,76%,95%)] group-[.toaster]:!text-[hsl(142,76%,30%)] group-[.toaster]:!border-[hsl(142,76%,70%)]",
          error: "group-[.toaster]:!bg-[hsl(0,84%,95%)] group-[.toaster]:!text-[hsl(0,84%,35%)] group-[.toaster]:!border-[hsl(0,84%,70%)]",
          warning: "group-[.toaster]:!bg-[hsl(38,92%,95%)] group-[.toaster]:!text-[hsl(38,92%,30%)] group-[.toaster]:!border-[hsl(38,92%,60%)]",
          info: "group-[.toaster]:!bg-[hsl(38,92%,95%)] group-[.toaster]:!text-[hsl(38,92%,30%)] group-[.toaster]:!border-[hsl(38,92%,60%)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
