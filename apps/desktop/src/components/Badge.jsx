export default function Badge({ status }) {
  return (
    <span className={status === "ACTIVE" ? "badge active" : "badge"}>
      <i />
      {status === "ACTIVE" ? "Aktiv" : "Joaktiv"}
    </span>
  );
}
