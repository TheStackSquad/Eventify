// frontend/src/components/ticketUI/components/QRCodeDisplay.js

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";

const QRCodeDisplay = ({ uniqueTicketId }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize the QR code data URL to prevent unnecessary regenerations
  const qrCodeData = useMemo(() => {
    if (!uniqueTicketId) return "";
    // Encode the ticket ID for QR code generation
    return encodeURIComponent(uniqueTicketId);
  }, [uniqueTicketId]);

  // Generate QR code URL with proper error handling
  useEffect(() => {
    let isMounted = true;

    const generateQRCode = async () => {
      if (!qrCodeData) {
        if (isMounted) {
          setIsLoading(false);
          setError("No ticket data available");
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use a reliable QR code generation service with proper caching
        const qrCodeServiceUrl = `https://api.qrserver.com/v1/create-qr-code/`;
        const params = new URLSearchParams({
          size: "300x300", // Higher resolution for better quality on all screens
          data: qrCodeData,
          format: "png",
          margin: "4", // Add margin for better scanner detection
          qzone: "2", // Quiet zone
          color: "000000", // Black QR code
          bgcolor: "FFFFFF", // White background
          ecc: "H", // High error correction (30%)
        });

        const url = `${qrCodeServiceUrl}?${params.toString()}`;

        // Preload the image to ensure it's ready before displaying
        await new Promise((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => {
            if (isMounted) {
              setQrCodeUrl(url);
              setIsLoading(false);
            }
            resolve();
          };
          img.onerror = () => {
            if (isMounted) {
              setError("Failed to generate QR code");
              setIsLoading(false);
            }
            reject(new Error("QR code generation failed"));
          };
          img.src = url;
        });
      } catch (err) {
        if (isMounted) {
          console.error("QR code generation failed:", err);
          setError("Unable to generate QR code");
          setIsLoading(false);
        }
      }
    };

    // Add a small delay to prevent rapid re-renders
    const timer = setTimeout(() => {
      generateQRCode();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [qrCodeData]);

  // Fallback to client-side QR generation if external service fails
  const renderQRCode = () => {
    if (isLoading) {
      return (
        <div
          className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse rounded-xl"
          aria-label="Loading QR code"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-1 bg-gray-300 animate-pulse rounded-full"></div>
          </div>
        </div>
      );
    }

    if (error || !qrCodeUrl) {
      return (
        <div
          className="relative w-full h-full bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-dashed border-red-200 flex flex-col items-center justify-center p-4"
          role="alert"
          aria-label="QR code generation failed"
        >
          <div className="text-red-600 text-xs font-medium text-center">
            <p>QR Code</p>
            <p className="font-mono text-[10px] mt-2 break-all px-2">
              {uniqueTicketId || "No ticket ID"}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <Image
          src={qrCodeUrl}
          alt={`QR Code for ticket ${uniqueTicketId}. Scan to verify authenticity.`}
          width={300}
          height={300}
          className="object-contain rounded-lg w-full h-full"
          sizes="(max-width: 640px) 128px, (max-width: 768px) 144px, 160px"
          loading="lazy"
          decoding="async"
          quality={85}
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWQpIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjBmMGYwOyIgLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZTVlNWU1OyIgLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4="
          onError={() => {
            setError("Failed to load QR code image");
            setIsLoading(false);
          }}
          style={{
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
          }}
        />
      </div>
    );
  };

  return (
    <div className="relative group" role="region" aria-label="Ticket QR Code">
      {/* Main QR Code Container */}
      <div className="relative aspect-square w-full max-w-[160px] sm:max-w-[180px] md:max-w-[200px] mx-auto">
        {renderQRCode()}

        {/* Overlay border with decorative corners */}
        <div
          className="absolute inset-0 border-2 border-dashed border-gray-300/70 rounded-xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Corner accents */}
        <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-red-500 rounded-tl-lg pointer-events-none" />
        <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-red-500 rounded-tr-lg pointer-events-none" />
        <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-red-500 rounded-bl-lg pointer-events-none" />
        <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-red-500 rounded-br-lg pointer-events-none" />
      </div>

      {/* Scan hint (visible on hover/focus) */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none"
        aria-hidden="true"
      >
        <div className="text-[10px] text-gray-500 font-medium bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full border border-gray-200 whitespace-nowrap">
          Scan to verify
        </div>
      </div>

      {/* Screen reader only instructions */}
      <div className="sr-only">
        <p>
          This QR code contains your unique ticket identifier: {uniqueTicketId}
        </p>
        <p>
          Event staff will scan this code to verify your ticket authenticity.
        </p>
      </div>
    </div>
  );
};

export default QRCodeDisplay;
