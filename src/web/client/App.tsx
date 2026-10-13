import { CurrentPage, pageLabel } from "./components/pages/CurrentPage.js";
import { Footer } from "./components/sections/Footer.js";
import { Header } from "./components/sections/Header.js";
import { useDocumentTitle } from "./useDocumentTitle.js";
import { usePath } from "./usePath.js";

/** Lays out the web UI: the header, the page for the current address, and the footer. */
export function App() {
  const navigation = usePath();
  useDocumentTitle(pageLabel(navigation.path));
  return (
    <>
      <Header {...navigation} />
      <CurrentPage path={navigation.path} />
      <Footer />
    </>
  );
}
