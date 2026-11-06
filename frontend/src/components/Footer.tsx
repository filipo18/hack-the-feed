import { PRODUCT_NAME } from "../content";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-mark">{PRODUCT_NAME}</p>
      <p>
        Reach estimates show what the same views would cost to buy. They are not money owed.
      </p>
    </footer>
  );
}
