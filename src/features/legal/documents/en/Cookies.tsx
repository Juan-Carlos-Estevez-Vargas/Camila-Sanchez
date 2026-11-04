import { openCookiePreferences } from "@/services/consent/cookieConsent";

export function Cookies() {
  return (
    <>
      <h2>Summary</h2>
      <p>
        The app <strong>does not use cookies</strong>, its own or third-party, for advertising, analytics or tracking. To
        work, your browser keeps some data in its local storage (<em>localStorage</em>, <em>sessionStorage</em> and
        <em> IndexedDB</em>), which is similar to a cookie but is never sent to any server on its own.
      </p>

      <h2>What is always stored (necessary)</h2>
      <p>Without this the app would not work or would have to ask you the same things every time. It does not need your permission, but we are telling you anyway.</p>
      <table>
        <thead>
          <tr><th scope="col">What</th><th scope="col">What for</th><th scope="col">How long</th></tr>
        </thead>
        <tbody>
          <tr><td>Session</td><td>Knowing you have signed in. With "keep me signed in" it stays saved; without it, it is cleared when you close the tab.</td><td>Until you sign out</td></tr>
          <tr><td>Quick copy of the content</td><td>So the page opens instantly and works offline. It is cleared when you sign out.</td><td>Until you sign out</td></tr>
          <tr><td>Preferences</td><td>Reduced motion, your language, the tutorial already seen, surprises already seen and your choice in this notice.</td><td>Until you clear your browser data</td></tr>
          <tr><td>Phone notifications</td><td>The <em>service worker</em> that receives notifications, if you turn them on.</td><td>Until you turn them off</td></tr>
        </tbody>
      </table>

      <h2>What is optional (with your permission)</h2>
      <table>
        <thead>
          <tr><th scope="col">What</th><th scope="col">Provider</th><th scope="col">What happens if you accept</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Typefaces</td>
            <td>Google Fonts (Google LLC)</td>
            <td>Your browser downloads the fonts from Google's servers, which receive your IP address and browser. According to Google, it does not use them to build profiles or for advertising. If you do not accept, your device's fonts are used.</td>
          </tr>
        </tbody>
      </table>

      <h2>Security services</h2>
      <p>
        If the administrator turns on the "I am not a robot" check (Cloudflare Turnstile), a Cloudflare box is loaded when
        you sign in, which may use its own storage only to detect robots. It is needed for account security and is not used
        for advertising.
      </p>

      <h2>Changing your choice</h2>
      <p>
        You can change it whenever you want, also from "Cookie preferences" in the footer. And you can always delete
        everything from your browser settings.
      </p>
      <p>
        <button type="button" className="btn btn--soft" onClick={openCookiePreferences}>Open cookie preferences</button>
      </p>
    </>
  );
}
