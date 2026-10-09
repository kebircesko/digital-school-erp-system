export default function Badge({ status }: { status: string }) {
  return (
    <span className={status === "ACTIVE" ? "badge active" : "badge"}>
      <i />
      {status === "ACTIVE" ? "Aktiv" : "Joaktiv"}
    </span>
  );
}
