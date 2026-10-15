import { randomBytes } from "node:crypto";
import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { GmailConnectionRow } from "../../src/db/store.js";
import { seal } from "../../src/gmail/seal.js";
import { gmailPanelView } from "../../src/web/gmailPanel.js";
import { GmailPanel } from "../../web/components/settings/GmailPanel.js";
import { gmailRow } from "../helpers/gmailRows.js";

const actions = vi.hoisted(() => ({ saveGmailCredentials: vi.fn(), clearGmailCredentials: vi.fn() }));

vi.mock("../../web/lib/gmailActions.js", () => actions);

const KEY = randomBytes(32);
const PLAIN = "plain-secret-value-123";

beforeEach(() => {
    actions.saveGmailCredentials.mockReset().mockResolvedValue({ ok: false, error: "The client secret must be 1–255 characters." });
});

function renderPanel(row: GmailConnectionRow | null, host = "localhost:8080") {
    return render(<GmailPanel view={gmailPanelView(row, { keyStatus: "ok", keyChanged: false, host })} />);
}

test("saved credentials show the client ID but never the secret, and a refused save shows why", async () => {
    const sealed = seal(PLAIN, "client_secret", KEY);
    const { container } = renderPanel(gmailRow({ client_secret: sealed }));
    expect(screen.getByText(/client-1/)).toBeTruthy();
    expect(screen.getByText(/secret saved/)).toBeTruthy();
    const secret = container.querySelector<HTMLInputElement>("input[name=client_secret]");
    expect([secret?.value, secret?.type, secret?.getAttribute("autocomplete")]).toEqual(["", "password", "off"]);
    expect(container.innerHTML).not.toContain(sealed);
    expect(container.innerHTML).not.toContain(PLAIN);
    const empty = renderPanel(null);
    await userEvent.click(within(empty.container).getByRole("button", { name: "Save" }));
    expect((await within(empty.container).findByRole("alert")).textContent).toBe("The client secret must be 1–255 characters.");
});
