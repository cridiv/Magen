import Hero from "./components/Hero";
import Navbar from "./components/Navbar";
import Dashboard from "./dashboard/dashboard";

export default function Home() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Dashboard />
    </div>
  );
}
