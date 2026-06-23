/**
 * Device Detection and Restriction Firewall
 * Blocks iOS, Desktop, Emulators, and Tablets
 * Allows Android Mobile only
 */

export interface DeviceInfo {
  isAndroidMobile: boolean;
  isIOS: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  isEmulator: boolean;
  deviceId: string;
  userAgent: string;
  reason?: string;
}

/**
 * Detect if device is Android mobile
 */
function isAndroidMobile(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for Android
  const isAndroid = /android/.test(ua);
  if (!isAndroid) return false;
  
  // Check if it's NOT a tablet
  const isTablet = /ipad|android 3|android 4|android 5|android 6|android 7|android 8|android 9|android 10|android 11|android 12|android 13/.test(ua) &&
    !/mobile/.test(ua);
  
  if (isTablet) return false;
  
  // Check for common emulator signatures
  const isEmulator = /emulator|simulator|bluestacks|nox|memu|ldplayer|andy|genymotion/.test(ua);
  if (isEmulator) return false;
  
  return true;
}

/**
 * Detect if device is iOS
 */
function isIOS(): boolean {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

/**
 * Detect if device is tablet
 */
function isTablet(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /ipad|android/.test(ua) && !/mobile/.test(ua);
}

/**
 * Detect if device is desktop
 */
function isDesktop(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return !/android|iphone|ipad|ipod|mobile|tablet/.test(ua);
}

/**
 * Detect if device is an emulator
 */
function isEmulator(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /emulator|simulator|bluestacks|nox|memu|ldplayer|andy|genymotion|noxplayer/.test(ua);
}

/**
 * Generate device fingerprint ID
 */
function generateDeviceId(): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    return Math.random().toString(36).substring(2, 15);
  }
  
  ctx.textBaseline = "top";
  ctx.font = "14px Arial";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f60";
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("Device Fingerprint", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("Device Fingerprint", 4, 17);
  
  const fingerprint = canvas.toDataURL();
  return btoa(fingerprint).substring(0, 32);
}

/**
 * Get complete device information
 */
export function getDeviceInfo(): DeviceInfo {
  const android = isAndroidMobile();
  const ios = isIOS();
  const desktop = isDesktop();
  const tablet = isTablet();
  const emulator = isEmulator();
  
  let reason: string | undefined;
  
  if (ios) {
    reason = "iOS devices are not supported. Please use Android.";
  } else if (desktop) {
    reason = "Desktop browsers are not supported. Please use Android mobile.";
  } else if (tablet) {
    reason = "Tablets are not supported. Please use Android mobile phone.";
  } else if (emulator) {
    reason = "Emulators are not allowed. Please use a real Android device.";
  }
  
  return {
    isAndroidMobile: android,
    isIOS: ios,
    isDesktop: desktop,
    isTablet: tablet,
    isEmulator: emulator,
    deviceId: generateDeviceId(),
    userAgent: navigator.userAgent,
    reason,
  };
}

/**
 * Check if device is allowed
 */
export function isDeviceAllowed(): boolean {
  const device = getDeviceInfo();
  return device.isAndroidMobile && !device.isEmulator;
}

/**
 * Get device restriction message
 */
export function getDeviceRestrictionMessage(): string | null {
  const device = getDeviceInfo();
  return device.reason || null;
}

/**
 * Send device violation to server for banning
 */
export async function reportDeviceViolation(userId: number, reason: string): Promise<void> {
  const device = getDeviceInfo();
  
  try {
    await fetch("/api/trpc/security.reportViolation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        reason,
        device: {
          userAgent: device.userAgent,
          deviceId: device.deviceId,
          isIOS: device.isIOS,
          isDesktop: device.isDesktop,
          isTablet: device.isTablet,
          isEmulator: device.isEmulator,
        },
      }),
    });
  } catch (error) {
    console.error("Failed to report device violation:", error);
  }
}
