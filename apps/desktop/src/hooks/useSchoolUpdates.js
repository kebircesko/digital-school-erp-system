import { useEffect, useState } from "react";

export function useSchoolUpdates() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("student-updated", refresh);
    window.addEventListener("billing-updated", refresh);
    return () => {
      window.removeEventListener("student-updated", refresh);
      window.removeEventListener("billing-updated", refresh);
    };
  }, []);
  return revision;
}
