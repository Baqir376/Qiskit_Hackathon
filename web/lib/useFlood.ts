"use client";
import { useEffect, useState } from "react";
import { BASE_PATH, type FloodData } from "./data";

export function useFlood() {
  const [data, setData] = useState<FloodData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${BASE_PATH}/data/flood.json`).then((r) => r.json()).then(setData).catch((e) => setErr(String(e)));
  }, []);
  return { data, err };
}
