import Image from "next/image";
import Hero from "./components/Hero";
import Navbar from "./components/Navbar";

export default function Home() {
  return (
    <div>
      <Navbar />
      <Hero />
    </div>
  );
}
