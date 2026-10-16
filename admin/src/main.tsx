import "~/styles/admin.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { createAdminRouter } from "~/app/router";
import { I18nProvider } from "~/i18n/i18n";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The admin console needs a #root element in index.html.");
}

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={createAdminRouter()} />
    </I18nProvider>
  </StrictMode>,
);
