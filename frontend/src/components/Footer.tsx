import { PRODUCT_NAME } from "../content";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-mark">{PRODUCT_NAME}</p>
      <p>
        Impressions are video views on posts with no ad marker. Dollar values are estimates of what that reach would cost to buy, not money owed.
      </p>
    </footer>
  );
}
