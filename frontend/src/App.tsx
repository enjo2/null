import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { applyAccent, usePrefsSnapshot } from "./lib/prefs";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Results } from "./pages/Results";
import { ComparePrivacy } from "./pages/ComparePrivacy";
import { About } from "./pages/About";
import { Privacy } from "./pages/Privacy";
import { Faq } from "./pages/Faq";
import { Contact } from "./pages/Contact";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";

export default function App() {
  // Apply the persisted accent color once at startup.
  useEffect(() => {
    applyAccent(usePrefsSnapshot().accent);
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Results />} />
        <Route path="/compare-privacy" element={<ComparePrivacy />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}