import { appIcon } from "@/lib/app-icon";

// iOS home screen icon (iOS ignores the manifest icons and rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180, 36);
}
