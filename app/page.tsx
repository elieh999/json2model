import { ConverterApp } from "@/src/components/ConverterApp";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <ConverterApp />
    </ErrorBoundary>
  );
}
