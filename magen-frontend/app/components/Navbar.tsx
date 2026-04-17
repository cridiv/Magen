"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NavBar = () => {
  const router = useRouter();

  return (
    <header className="pb-2 sticky top-0 w-full shrink-0 bg-primary/50 backdrop-blur-xl z-30">
      <div className="flex justify-between items-center gap-5 w-full max-w-7xl px-2 md:px-6 h-[3.5rem] mx-auto">
        <div
          role="link"
          tabIndex={0}
          className="select-none cursor-pointer outline-0"
          onClick={() => router.push("/")}
        >
          <h1 className="text-[24px] ">
            Magen{" "}
            <span className="text-sm text-white  p-[6px] border-solid border-[1.3px] border-white rounded-full">
              Beta
            </span>
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/signin"
            className="appearance-none cursor-pointer px-6 py-1 font-heading rounded-full text-sm bg-white/10 border border-white/20 hover:bg-white/20 focus-visible:bg-white/20 text-white backdrop-blur-sm transition-all duration-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
};

export default NavBar;
