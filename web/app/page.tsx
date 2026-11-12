"use client";
import { MotionConfig } from "motion/react";
import { useCallback, useState } from "react";
import AjrakBand from "@/components/AjrakBand";
import AppTeaser from "@/components/AppTeaser";
import Closing from "@/components/Closing";
import Cursor from "@/components/Cursor";
import Dilemma from "@/components/Dilemma";
import Hero from "@/components/Hero";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Pareto from "@/components/Pareto";
import Qubits from "@/components/Qubits";
import Results from "@/components/Results";
import { DataCtx } from "@/lib/data";
import { useFlood } from "@/lib/useFlood";

export default function Landing() {
  const { data, err } = useFlood();
  const [intro, setIntro] = useState(false);
  const done = useCallback(() => setIntro(true), []);
  return (
    <MotionConfig reducedMotion="user">
      <Cursor />
      <Loader ready={!!data} onDone={done} />
      {err && <div className="p-10 text-danger">Failed to load data: {err}</div>}
      {data && (
        <DataCtx.Provider value={data}>
          <Nav show={intro} />
          <main>
            <Hero start={intro} />
            <AjrakBand />
            <Dilemma />
            <Qubits />
            <AjrakBand reverse />
            <AppTeaser />
            <Pareto />
            <AjrakBand />
            <Results />
            <Closing />
          </main>
        </DataCtx.Provider>
      )}
    </MotionConfig>
  );
}
