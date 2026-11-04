import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>The app is free</h2>
      <p>
        We charge nothing: not for creating the account, nor for using it, nor for storing photos or messages. There are no
        paid plans, subscriptions, in-app purchases, auto-renewing trial periods, tips or "maintenance" fees.
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

      <h2>Refunds</h2>
      <p>
        Since there are no payments, there is nothing to refund and no right of withdrawal to exercise (Colombian Law 1480 of
        2011). If one day the app started charging for something, the price, how to pay and how to ask for a refund would
        be published here first, and you would be asked to accept it explicitly. You would never be charged without accepting.
      </p>
      <p>
        Everything else is in the <Link to={legalPath("terminos")}>terms and conditions</Link>.
      </p>
    </>
  );
}
