import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Services } from "./components/Services";
import { Advertisers } from "./components/Advertisers";
import { Publishers } from "./components/Publishers";
import { Products } from "./components/Products";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Advertisers />
        <Publishers />
        <Products />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
