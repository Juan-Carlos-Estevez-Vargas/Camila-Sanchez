import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>The app is free</h2>
      <p>
        We charge nothing: not for creating the account, nor for using it, nor for storing photos or messages. There are no
        paid plans, subscriptions, in-app purchases, auto-renewing trial periods or "maintenance" fees. No feature depends on
        paying.
      </p>

      <h2>No hidden charges</h2>
      <ul>
        <li>The app never asks for a card, a bank account or any payment details.</li>
        <li>The browser's payment permissions are turned off on every page.</li>
        <li>We do not show ads or affiliate links.</li>
      </ul>
      <p>
        If someone asks you for money on behalf of this app, it is not us: do not pay and tell the administrator.
      </p>

      <h2>Voluntary donations</h2>
      <p>
        The header and footer may have a "Buy me a coffee" button. It is a link to an external platform (for example Ko-fi):
        if you decide to donate, the payment is made by that platform under its own terms and privacy policy, and the app
        does not receive your payment details. Donating is completely optional, unlocks nothing and does not change how the
        app works in any way. If you want a donation refunded, ask through that platform or write to the administrator.
      </p>

      <h2>Refunds</h2>
      <p>
        Since the app charges nothing, there is nothing to refund and no right of withdrawal to exercise (Colombian Law 1480 of
        2011). If one day the app started charging for something, the price, how to pay and how to ask for a refund would
        be published here first, and you would be asked to accept it explicitly. You would never be charged without accepting.
      </p>
      <p>
        Everything else is in the <Link to={legalPath("terminos")}>terms and conditions</Link>.
      </p>
    </>
  );
}
