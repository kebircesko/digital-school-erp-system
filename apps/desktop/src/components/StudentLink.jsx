import { createContext, useContext } from "react";

export const StudentWorkspaceContext = createContext(null);

export default function StudentLink({ id, children }) {
  const openStudent = useContext(StudentWorkspaceContext);
  if (!id || !openStudent) return <>{children}</>;
  return (
    <button
      type="button"
      className="student-link"
      onClick={(event) => {
        event.stopPropagation();
        openStudent(id);
      }}
      title="Hap profilin dhe veprimet e nxënësit"
    >
      {children}
    </button>
  );
}
