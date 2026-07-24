import { MessageCircle } from "lucide-react";

/**
 * Reusable WhatsApp Support Button Component
 * Displays as a floating button on all pages
 */
export function WhatsAppSupport({
  phoneNumber = "919876543210",
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
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50"
      title="WhatsApp Support"
      aria-label="Open WhatsApp support"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

/**
 * Alternative WhatsApp button with custom styling for gaming theme
 */
export function WhatsAppSupportGaming({
  phoneNumber = "919876543210",
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
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50 border-2 border-green-400/50 hover:border-green-300"
      title="WhatsApp Support"
      aria-label="Open WhatsApp support"
    >
      <svg
        className="h-7 w-7"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.781 1.146l-.313.156-.325-.067c-1.364-.272-2.657-.856-3.71-1.705l-.106-.089-.11.005C2.752 6.11 2 7.244 2 8.522 2 13.956 6.612 18.13 12.06 18.13c1.52 0 2.956-.278 4.275-.823l.314.1.323.011c1.427 0 2.747-.811 3.428-2.047l.107-.189-.127-.081c-.231-.146-.447-.283-.646-.41.174.031.404.053.577.053.968 0 1.882-.285 2.657-.823l.423-.273-.423-.043c-.159-.02-.329-.033-.499-.033-.968 0-1.88.286-2.657.824l-.423.272.423.043c.159.02.329.033.499.033.968 0 1.882-.285 2.657-.823l.423-.273-.423-.043c-.159-.02-.329-.033-.499-.033z" />
      </svg>
    </a>
  );
}
