import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "../Contact";

/** Personal data processing policy (Colombian Law 1581 of 2012, Decree 1074 of 2015). */
export function Privacy() {
  return (
    <>
      <h2>1. Who looks after your data</h2>
      <p>
        The data controller is <strong>{DATA_CONTROLLER.name}</strong>, an individual in {DATA_CONTROLLER.country}.
        You can contact him <Contact />.
      </p>
      <p>
        This is a private, free app made for a couple and the few people they invite. It is not a commercial
        service, it has no ads and it does not sell or rent data to anyone.
      </p>

      <h2>2. What data we keep</h2>
      <p>Only what the app needs to work. None of it is mandatory except your account details.</p>
      <table>
        <thead>
          <tr><th scope="col">Type</th><th scope="col">What it includes</th><th scope="col">Where it comes from</th></tr>
        </thead>
        <tbody>
          <tr><td>Account</td><td>Email, name and role. Your password is stored encrypted (hashed): nobody, not even the administrator, can read it.</td><td>You, when you create the account</td></tr>
          <tr><td>Profile (optional)</td><td>Photo or icon, a phrase, your birthday and your colors.</td><td>You, in My account</td></tr>
          <tr><td>What you share</td><td>Photos and their captions, notes, messages, chat photos and stickers, reactions, lists, tasks, dates and surprises.</td><td>You, while using the app</td></tr>
          <tr><td>App usage</td><td>Your last connection, which messages you have read ("seen") and a change log (who changed what and when) to look into errors or abuse.</td><td>The app, while you use it</td></tr>
          <tr><td>Technical data</td><td>If you turn on phone notifications: your browser's push service address and browser type. Servers briefly keep logs with your IP address, for security.</td><td>Your browser</td></tr>
        </tbody>
      </table>
      <p>
        Photos are optimized on your own device before upload and camera metadata, such as GPS location, is removed.
        <strong> We do not ask for sensitive data</strong> (health, religion, political views, biometric data…): please
        do not upload it. If you upload a photo showing other people, only do so with their permission.
      </p>

      <h2>3. What we use it for</h2>
      <ul>
        <li>Letting you sign in, see the page, write in the chat, share lists and get notifications.</li>
        <li>Showing the people you talk to your name, your photo and whether you have read their messages.</li>
        <li>Protecting the app: stopping brute-force sign-in attempts, investigating errors and keeping backups.</li>
      </ul>
      <p>
        We do <strong>not</strong> use your data for advertising, we do not build behavioral profiles, we do not sell it
        and we do not use it to train artificial intelligence.
      </p>

      <h2>4. Who it is shared with</h2>
      <p>
        Nobody outside the people in the app sees your data, according to their permissions. To work, the app uses these
        providers, who act as <em>processors</em> and only handle it to provide their service:
      </p>
      <table>
        <thead>
          <tr><th scope="col">Provider</th><th scope="col">What for</th><th scope="col">What it receives</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase</td><td>Database, accounts, photos and live messages</td><td>Everything in section 2</td></tr>
          <tr><td>Netlify</td><td>Hosting the page</td><td>IP address and browser when you visit</td></tr>
          <tr><td>Google Fonts</td><td>Typefaces, <strong>only if you accept them</strong> in the cookie notice</td><td>IP address and browser</td></tr>
          <tr><td>Cloudflare Turnstile</td><td>Checking you are not a robot when signing in, if enabled</td><td>IP address and browser signals</td></tr>
          <tr><td>Your browser's push service (Google, Apple or Mozilla)</td><td>Delivering notifications to your phone, only if you turn them on</td><td>An encrypted notification; they cannot read its content</td></tr>
        </tbody>
      </table>
      <p>
        The GitHub, LinkedIn or Instagram links in the footer only take you to those sites if you open them; the app
        loads nothing from them. If the page has background music, the file is requested from its server only when you press ♪.
      </p>

      <h2>5. Where it is stored</h2>
      <p>
        These providers' servers may be outside Colombia (for example in the United States). By accepting this policy
        you authorize that international transfer, which is made with providers that offer encryption and recognized
        security measures.
      </p>

      <h2>6. How long</h2>
      <p>
        For as long as your account exists. If you ask for it to be deleted, your account, profile, chat messages and
        usage data are removed. Some shared things you created (for example album photos or tasks in a shared list) may
        stay without your name so the app does not break for everyone else; if you want those deleted too, say so when
        you ask. The provider's backups overwrite themselves within a few days.
      </p>

      <h2>7. Your rights</h2>
      <p>Under Colombian Law 1581 of 2012 you have the right to:</p>
      <ul>
        <li>Know, update and correct your data (you can do almost all of it yourself in <Link to="/cuenta">My account</Link>).</li>
        <li>Ask for proof that you accepted this policy.</li>
        <li>Know how your data has been used.</li>
        <li>Withdraw your authorization and ask for your data to be deleted, when there is no legal duty to keep it.</li>
        <li>Access your data free of charge.</li>
        <li>File complaints with the Superintendence of Industry and Commerce (SIC) if you are not answered as the law requires.</li>
      </ul>
      <p>
        To exercise them, write <Contact />. Inquiries are answered within 10 business days at most and claims (correcting,
        deleting or withdrawing authorization) within 15 business days at most, as the law requires.
      </p>

      <h2>8. Minors</h2>
      <p>
        The app is not meant for minors. If someone under 18 receives an invitation, they need authorization from their
        mother, father or legal guardian before creating the account.
      </p>

      <h2>9. Security</h2>
      <p>
        Everything travels encrypted (HTTPS), photos are in private storage, every database table has rules that only
        show you what belongs to you, and there is no public sign-up: you can only get in with an invitation. No system is
        100% secure; if you notice anything strange, tell the controller as soon as possible.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        If something important changes, the date above is updated and the app will ask you to read and accept the new
        version the next time you sign in. The <Link to={legalPath("terminos")}>terms and conditions</Link> and
        the <Link to={legalPath("cookies")}>cookie policy</Link> also apply.
      </p>
    </>
  );
}
