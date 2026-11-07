import { PRODUCT_NAME } from "../content";
import { SAMPLE_MODE } from "../lib/mode";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-mark">{PRODUCT_NAME}</p>
      <p>
        {SAMPLE_MODE
          ? "Impressions are video views on posts with no disclosure. Dollar values are estimates of what that reach would cost to buy, not money owed."
          : "Post views are not unique people. Disclosure is disclosed or unknown, and neither means a post was unpaid. Illustrative prices on the marketing page are examples, not a bill."}
      </p>
    </footer>
  );
}
