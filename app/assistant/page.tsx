import { AssistantChat } from "../components/AssistantChat";

export default function AssistantPage() {
  return (
    <>
      <h1 className="greeting" style={{ fontSize: 20, marginBottom: 14 }}>
        Ask Nestly
      </h1>
      <AssistantChat />
    </>
  );
}
