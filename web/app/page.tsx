"use client";
import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import Closing from "@/components/Closing";
import Dilemma from "@/components/Dilemma";
import Hero from "@/components/Hero";
import Lab from "@/components/Lab";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Pareto from "@/components/Pareto";
import Qubits from "@/components/Qubits";
import Results from "@/components/Results";
import { BASE_PATH, DataCtx, type FloodData } from "@/lib/data";

export default function Page() {
  const [data, setData] = useState<FloodData | null>(null);
  const [intro, setIntro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${BASE_PATH}/data/flood.json`).then((r) => r.json()).then(setData).catch((e) => setErr(String(e)));
  }, []);
  const done = useCallback(() => setIntro(true), []);

  return (
    <MotionConfig reducedMotion="user">
      <Loader ready={!!data} onDone={done} />
      {err && <div className="p-10 text-danger">Failed to load data: {err}</div>}
      {data && (
        <DataCtx.Provider value={data}>
          <Nav show={intro} />
          <main>
            <Hero start={intro} />
            <Dilemma />
            <Qubits />
            <Lab />
            <Pareto />
            <Results />
            <Closing />
          </main>
        </DataCtx.Provider>
      )}
    </MotionConfig>
  );
}
