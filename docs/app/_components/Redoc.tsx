"use client";

import dynamic from "next/dynamic";
import openApiSpec from "../../../spec/api/v1/openapi.json";

const RedocStandalone = dynamic(
  () => import("redoc").then((mod) => mod.RedocStandalone),
  { ssr: false },
);

export default function RedocViewer() {
  return (
    <RedocStandalone
      spec={openApiSpec}
      options={{
        scrollYOffset: 60,
        hideDownloadButton: true,
        nativeScrollbars: true,
      }}
    />
  );
}
