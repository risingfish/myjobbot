import { redirect } from "next/navigation.js";

/** Sends the root address to the Recommended page. */
export default function Home(): never {
    redirect("/recommended");
}
