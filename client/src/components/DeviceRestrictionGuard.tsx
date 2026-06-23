import { useEffect, useState } from "react";
import { AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDeviceInfo, isDeviceAllowed, reportDeviceViolation } from "@/lib/deviceDetection";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Device Restriction Guard Component
 * Blocks non-Android devices and shows appropriate warnings
 */
export function DeviceRestrictionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [deviceAllowed, setDeviceAllowed] = useState<boolean | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<ReturnType<typeof getDeviceInfo> | null>(null);

  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
    
    const allowed = isDeviceAllowed();
    setDeviceAllowed(allowed);

    // If device is not allowed and user is authenticated, report violation
    if (!allowed && user?.id) {
      reportDeviceViolation(
        user.id,
        info.reason || "Unknown device violation"
      );
    }
  }, [user?.id]);

  if (deviceAllowed === null) {
    return <>{children}</>;
  }

  if (!deviceAllowed && deviceInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md rounded-lg border-2 border-destructive bg-destructive/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold text-destructive">Device Not Supported</h1>
          
          {deviceInfo.isIOS && (
            <div>
              <p className="mb-4 text-muted-foreground">
                iOS devices are not supported on this platform.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Please use an Android mobile phone to access Pro-Esports.
              </p>
            </div>
          )}

          {deviceInfo.isDesktop && (
            <div>
              <p className="mb-4 text-muted-foreground">
                Desktop browsers are not supported on this platform.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Please use an Android mobile phone to access Pro-Esports.
              </p>
            </div>
          )}

          {deviceInfo.isTablet && (
            <div>
              <p className="mb-4 text-muted-foreground">
                Tablets are not supported on this platform.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Please use an Android mobile phone to access Pro-Esports.
              </p>
            </div>
          )}

          {deviceInfo.isEmulator && (
            <div>
              <p className="mb-4 text-muted-foreground">
                Emulators and virtual devices are not allowed.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Please use a real Android mobile phone to access Pro-Esports.
              </p>
              <p className="mb-6 text-xs text-destructive font-semibold">
                ⚠️ Violation detected. Your account may be flagged for review.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-lg bg-background p-3">
              <Smartphone className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Use Android Mobile Only
              </span>
            </div>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
              variant="outline"
            >
              Refresh Page
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            If you believe this is an error, please contact support via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
