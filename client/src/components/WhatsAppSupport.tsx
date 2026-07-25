import { MessageCircle } from "lucide-react";

/**
 * Reusable WhatsApp Support Button Component
 * Displays as a floating button on all pages
 */
export function WhatsAppSupport({
  phoneNumber = "918334825288",
  message = "Hi%20I%20need%20support",
}: {
  phoneNumber?: string;
  message?: string;
}) {
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50 font-bold text-xs"
      title="WhatsApp Support"
      aria-label="Open WhatsApp support"
    >
      SUPPORT
    </a>
  );
}

/**
 * Alternative WhatsApp button with custom styling for gaming theme
 */
export function WhatsAppSupportGaming({
  phoneNumber = "918334825288",
  message = "Hi%20I%20need%20support",
}: {
  phoneNumber?: string;
  message?: string;
}) {
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50 border-2 border-green-400/50 hover:border-green-300 font-bold text-xs"
      title="WhatsApp Support"
      aria-label="Open WhatsApp support"
    >
      SUPPORT
    </a>
  );
}
