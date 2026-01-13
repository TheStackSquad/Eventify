// 'use client';

import React from "react";
import { Ticket, Users, Star, Music, Briefcase } from "lucide-react"; // Importing Lucide icons
import Image from "next/image";
import { useRouter } from "next/navigation";

const AboutUI = () => {
  const partners = [
    { id: 1, Icon: Ticket },
    { id: 2, Icon: Users },
    { id: 3, Icon: Star },
    { id: 4, Icon: Music },
    { id: 5, Icon: Briefcase },
  ];

  const router = useRouter();

  const handleBack = () => {
    router.push("/account/auth/create-account");
  };

  return (
    <div className="relative bg-white text-black overflow-hidden">
      {/* Clip Path Section */}
      <div className="absolute inset-0 clip-path-custom opacity-80 z-0"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-24 text-center lg:text-left">
        <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12">
          {/* Content Section */}
          <div className="max-w-2xl lg:w-1/2">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
              Welcome to <span className="text-yellow-300">Eventify</span>
            </h1>
            <p className="text-lg leading-relaxed mb-8">
              Eventify is your one-stop platform for seamless ticketing, vendor
              connections, and entertainment booking. Whether you are an event
              organizer, a vendor, or an entertainer, we bring you together to
              create unforgettable moments.
            </p>
            <div className="flex gap-4 justify-center lg:justify-start">
              <button
                className="bg-yellow-400 text-black px-6 py-3
              rounded-lg hover:bg-yellow-500 transition-transform
              transform hover:scale-105 shadow-md"
              >
                Learn More
              </button>
              <button
                onClick={handleBack}
                className="bg-transparent border-2 border-yellow-400 text-yellow-400
              px-6 py-3 rounded-lg hover:bg-yellow-400 hover:text-black
              transition-transform transform hover:scale-105 shadow-md"
              >
                Get Started
              </button>
            </div>
          </div>

          {/* Image Section */}
          <div className="w-full lg:w-1/2 flex items-center justify-center">
            <Image
              src="/img/ticket/ticket.avif"
              alt="About BandHit"
              className="rounded-xl shadow-2xl object-cover aspect-video"
              width={800}
              height={600}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <footer className="relative z-10 bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-center text-yellow-300 mb-8">
            Our Trusted Partners
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-center">
            {partners.map(({ id, Icon }) => (
              <div
                key={id}
                className="w-24 h-24 flex items-center justify-center rounded-full bg-slate-700 mx-auto hover:bg-yellow-400 transition-all duration-300 opacity-70 hover:opacity-100"
              >
                <Icon className="w-12 h-12 text-yellow-300 hover:text-black" />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutUI;
