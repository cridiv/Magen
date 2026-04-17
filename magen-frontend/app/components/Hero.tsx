"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

const Hero = () => {
  const { scrollY } = useScroll();

  const y1 = useTransform(scrollY, [0, 1000], [0, 1]);

  return (
    <div className="relative min-h-screen w-full p-0 md:p-8 flex items-center justify-center bg-[rgb(25, 26, 31)]">
      {/* Windowed Container for Larger Devices */}
      <motion.div
        initial={{ translateX: "-100px", opacity: 0 }}
        whileInView={{ translateX: "0px", opacity: 1 }}
        transition={{ type: "spring", duration: 3 }}
        viewport={{ once: true }}
        style={{ y: y1 }}
        className="relative w-full max-w-5xl mx-auto bg-linear-60 from-amber-500 to-blue-500 rounded-none md:rounded-3xl overflow-hidden shadow-none md:shadow-2xl"
      >
        {/* Content Section */}
        <div className="relative z-10 flex items-center justify-center min-h-screen md:min-h-[80vh] p-6 md:p-12">
          <div className="w-full max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Multi-agent <br />
              <span className="bg-[#f5f5f5] bg-clip-text text-transparent">
                AI debate system
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              Built for the Four.meme AI Sprint
            </p>

            <div className="flex justify-center">
              <Link
                href="/signin"
                className="group relative px-8 py-4 bg-[#0f0f0f] cursor-pointer text-white font-semibold rounded-full shadow-lg border-none hover:-translate-y-1 transition-all duration-300 transform hover:scale-105"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0  bg-[#1a1a1a] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Hero;
