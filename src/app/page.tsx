import { auth } from "../../auth";
import ChatInterface from "./ChatInterface";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return <ChatInterface userImage={session.user.image} userName={session.user.name} />;
}
