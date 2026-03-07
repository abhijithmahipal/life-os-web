import { auth } from "../../auth";
import ChatInterface from "./ChatInterface";

export default async function Home() {
  const session = await auth();

  // Middleware will naturally redirect to sign in, but this ensures strict structural typing
  if (!session?.user) return null;

  return <ChatInterface userImage={session.user.image} userName={session.user.name} />
}
